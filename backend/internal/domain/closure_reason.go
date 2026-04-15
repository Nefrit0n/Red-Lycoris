package domain

type ClosureReason struct {
	ID           int16  `json:"id"`
	Code         string `json:"code"`
	Label        string `json:"label"`
	TargetStatus int    `json:"target_status"`
	RequiresNote bool   `json:"requires_note"`
	IsActive     bool   `json:"is_active"`
}
