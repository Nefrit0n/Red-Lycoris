package policies

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/open-policy-agent/opa/v1/rego"
)

const (
	OutcomePass = "pass"
	OutcomeWarn = "warn"
	OutcomeFail = "fail"
)

var errNoDecision = errors.New("policy evaluation returned no decision")

const defaultEntrypoint = "data.policy.decision"

type Engine struct {
	repo  Repository
	cache *moduleCache
}

func NewEngine(repo Repository) *Engine {
	return &Engine{
		repo:  repo,
		cache: newModuleCache(),
	}
}

func (e *Engine) Evaluate(ctx Context) (Decision, error) {
	subjectID, err := uuid.Parse(ctx.Subject.ID)
	if err != nil {
		return Decision{}, fmt.Errorf("invalid subject id: %w", err)
	}

	inputJSON, err := ctx.StableJSON()
	if err != nil {
		return Decision{}, fmt.Errorf("stable input json: %w", err)
	}

	hash := sha256.Sum256(inputJSON)
	inputHash := hex.EncodeToString(hash[:])

	assignments, err := e.loadAssignments(context.Background(), ctx)
	if err != nil {
		return Decision{}, err
	}

	if len(assignments) == 0 {
		return Decision{Outcome: OutcomePass}, nil
	}

	aggregated := Decision{Outcome: OutcomePass}
	selectedMetaPriority := -1
	selectedOutcomeRank := 0

	for _, assignment := range assignments {
		if assignment.PolicyRuleID == nil {
			return Decision{}, fmt.Errorf("policy assignment %s missing policy rule", assignment.ID)
		}

		rule, err := e.repo.GetRuleContent(context.Background(), *assignment.PolicyRuleID)
		if err != nil {
			return Decision{}, err
		}

		decision, err := e.evaluateRule(context.Background(), rule, inputJSON)
		if err != nil {
			return Decision{}, err
		}

		var policyRuleID *string
		if assignment.PolicyRuleID != nil {
			value := assignment.PolicyRuleID.String()
			policyRuleID = &value
		}
		policyMeta := PolicyMeta{
			PolicyID:      assignment.PolicyID.String(),
			PolicyRuleID:  policyRuleID,
			PolicyVersion: rule.Version,
			Sha256:        rule.Sha256,
		}

		policyOutcome := normalizeOutcome(decision.Outcome)
		policyDecisionID := decision.DecisionID

		policyResult := PolicyResult{
			PolicyID:     assignment.PolicyID,
			PolicyRuleID: assignment.PolicyRuleID,
			SubjectType:  ctx.Subject.Type,
			SubjectID:    subjectID,
			Decision:     policyOutcome,
			Violations:   decision.Violations,
			InputHash:    inputHash,
			EvaluatedAt:  time.Now().UTC(),
		}
		if err := e.repo.WritePolicyResult(context.Background(), policyResult); err != nil {
			return Decision{}, err
		}

		aggregated.Actions = append(aggregated.Actions, decision.Actions...)
		aggregated.Violations = append(aggregated.Violations, decision.Violations...)

		aggregatedRank := outcomeRank(aggregated.Outcome)
		policyRank := outcomeRank(policyOutcome)
		if policyRank > aggregatedRank {
			aggregated.Outcome = policyOutcome
			aggregated.Policy = &policyMeta
			aggregated.DecisionID = policyDecisionID
			selectedOutcomeRank = policyRank
			selectedMetaPriority = assignment.Priority
		} else if policyRank == selectedOutcomeRank && policyRank > 0 {
			if assignment.Priority > selectedMetaPriority {
				aggregated.Policy = &policyMeta
				aggregated.DecisionID = policyDecisionID
				selectedMetaPriority = assignment.Priority
			}
		}
	}

	if aggregated.Policy == nil && len(assignments) > 0 {
		first := assignments[0]
		if first.PolicyRuleID != nil {
			rule, err := e.repo.GetRuleContent(context.Background(), *first.PolicyRuleID)
			if err != nil {
				return Decision{}, err
			}
			aggregated.Policy = &PolicyMeta{
				PolicyID:      first.PolicyID.String(),
				PolicyRuleID:  uuidToStringPtr(first.PolicyRuleID),
				PolicyVersion: rule.Version,
				Sha256:        rule.Sha256,
			}
		}
	}

	return aggregated, nil
}

func (e *Engine) evaluateRule(ctx context.Context, rule PolicyRule, inputJSON []byte) (Decision, error) {
	prepared, err := e.cache.getOrCompile(ctx, rule)
	if err != nil {
		return Decision{}, err
	}

	var input any
	if err := json.Unmarshal(inputJSON, &input); err != nil {
		return Decision{}, fmt.Errorf("decode input: %w", err)
	}

	results, err := prepared.Eval(ctx, rego.EvalInput(input))
	if err != nil {
		return Decision{}, fmt.Errorf("rego eval: %w", err)
	}
	if len(results) == 0 || len(results[0].Expressions) == 0 {
		return Decision{}, errNoDecision
	}

	var decision Decision
	value := results[0].Expressions[0].Value
	if value == nil {
		return Decision{Outcome: OutcomePass}, nil
	}

	raw, err := json.Marshal(value)
	if err != nil {
		return Decision{}, fmt.Errorf("marshal decision: %w", err)
	}
	if err := json.Unmarshal(raw, &decision); err != nil {
		return Decision{}, fmt.Errorf("unmarshal decision: %w", err)
	}
	decision.Outcome = normalizeOutcome(decision.Outcome)
	if decision.Outcome == "" {
		decision.Outcome = OutcomePass
	}
	return decision, nil
}

func normalizeOutcome(outcome string) string {
	switch outcome {
	case OutcomeFail, OutcomeWarn, OutcomePass:
		return outcome
	default:
		return OutcomePass
	}
}

func outcomeRank(outcome string) int {
	switch outcome {
	case OutcomeFail:
		return 3
	case OutcomeWarn:
		return 2
	case OutcomePass:
		return 1
	default:
		return 0
	}
}

func (e *Engine) loadAssignments(ctx context.Context, policyCtx Context) ([]PolicyAssignment, error) {
	scopes := assignmentScopes(policyCtx)
	assignments := make([]PolicyAssignment, 0)
	for _, scope := range scopes {
		items, err := e.repo.GetAssignments(ctx, scope)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, items...)
	}

	sort.SliceStable(assignments, func(i, j int) bool {
		if assignments[i].Priority == assignments[j].Priority {
			return assignments[i].ID.String() < assignments[j].ID.String()
		}
		return assignments[i].Priority > assignments[j].Priority
	})

	return assignments, nil
}

func assignmentScopes(policyCtx Context) []AssignmentScope {
	scopes := []AssignmentScope{
		{Scope: "global"},
	}
	if policyCtx.Product != nil {
		productID, err := uuid.Parse(policyCtx.Product.ID)
		if err == nil {
			scopes = append(scopes, AssignmentScope{Scope: "product", ScopeID: &productID})
		}
	}

	switch policyCtx.Subject.Type {
	case "import_job":
		id, err := uuid.Parse(policyCtx.Subject.ID)
		if err == nil {
			scopes = append(scopes, AssignmentScope{Scope: "import_job", ScopeID: &id})
		}
	case "scan_result":
		id, err := uuid.Parse(policyCtx.Subject.ID)
		if err == nil {
			scopes = append(scopes, AssignmentScope{Scope: "scan_result", ScopeID: &id})
		}
	}

	return scopes
}

func uuidToStringPtr(value *uuid.UUID) *string {
	if value == nil {
		return nil
	}
	clone := value.String()
	return &clone
}
