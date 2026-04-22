package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

const checkovSingleFixture = `{
  "check_type": "terraform",
  "results": {
    "passed_checks": [],
    "failed_checks": [
      {
        "check_id": "CKV_AWS_20",
        "bc_check_id": "BC_AWS_001",
        "check_name": "S3 Bucket has an ACL defined which allows public READ access.",
        "check_result": {
          "result": "FAILED",
          "results_configuration": [
            {
              "instruction": "Set ACL to private",
              "startline": 8,
              "endline": 10,
              "content": "acl = \"public-read\"",
              "value": "public-read"
            }
          ]
        },
        "code_block": [[8, "resource \"aws_s3_bucket\" \"bad\" {"], [9, "  acl = \"public-read\""], [10, "}"]],
        "file_path": "/tmp/main.tf",
        "repo_file_path": "terraform/main.tf",
        "file_line_range": [8, 10],
        "resource": "aws_s3_bucket.bad",
        "resource_address": "aws_s3_bucket.bad",
        "severity": "HIGH",
        "bc_category": "Network Security",
        "benchmarks": ["CIS-1.0"],
        "description": "Public ACL detected",
        "short_description": "S3 public ACL",
        "vulnerability_details": "Bucket objects may be exposed",
        "guideline": "https://docs.example.com/remediation"
      }
    ],
    "skipped_checks": [],
    "parsing_errors": []
  },
  "summary": {
    "passed": 0,
    "failed": 1,
    "skipped": 0,
    "parsing_errors": 0,
    "resource_count": 1,
    "checkov_version": "3.2.0"
  },
  "url": "https://bridgecrew.cloud/results/123"
}`

const checkovArrayFixture = `[
  {
    "check_type": "terraform",
    "results": {"passed_checks": [], "failed_checks": [], "skipped_checks": [], "parsing_errors": []},
    "summary": {"passed": 0, "failed": 0, "skipped": 0, "parsing_errors": 0, "resource_count": 0, "checkov_version": "3.2.0"},
    "url": ""
  },
  {
    "check_type": "kubernetes",
    "results": {
      "passed_checks": [],
      "failed_checks": [
        {
          "check_id": "CKV_K8S_10",
          "check_name": "Image tag should not be latest",
          "check_result": {"result": "FAILED", "results_configuration": [{"startline": 4, "endline": 4, "content": "image: nginx:latest"}]},
          "code_block": [],
          "file_path": "deployment.yaml",
          "file_line_range": [],
          "resource": "Deployment.default.nginx",
          "severity": "MEDIUM",
          "guideline": "https://example.org/k8s"
        }
      ],
      "skipped_checks": [],
      "parsing_errors": []
    },
    "summary": {"passed": 0, "failed": 1, "skipped": 0, "parsing_errors": 0, "resource_count": 1, "checkov_version": "3.2.0"},
    "url": "https://bridgecrew.cloud/results/456"
  }
]`

func TestCheckovParser_CanParse_SingleSection(t *testing.T) {
	p := &CheckovParser{}
	if !p.CanParse([]byte(checkovSingleFixture)) {
		t.Fatal("expected single section checkov payload to be detected")
	}
}

func TestCheckovParser_CanParse_ArraySection(t *testing.T) {
	p := &CheckovParser{}
	if !p.CanParse([]byte(checkovArrayFixture)) {
		t.Fatal("expected array checkov payload to be detected")
	}
}

func TestCheckovParser_Parse_SingleSection(t *testing.T) {
	p := &CheckovParser{}
	findings, err := p.Parse(context.Background(), []byte(checkovSingleFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}

	f := findings[0]
	if f.Kind != domain.KindIaC || f.SourceType != "checkov" {
		t.Fatalf("unexpected finding kind/source: %+v", f)
	}
	if f.RuleID == nil || *f.RuleID != "CKV_AWS_20" {
		t.Fatalf("unexpected rule id: %#v", f.RuleID)
	}
	if f.FilePath != "terraform/main.tf" {
		t.Fatalf("unexpected file path: %s", f.FilePath)
	}
	if f.LineStart != 8 || f.LineEnd != 10 {
		t.Fatalf("unexpected line range: %d-%d", f.LineStart, f.LineEnd)
	}
	if f.Severity != domain.SeverityHigh {
		t.Fatalf("unexpected severity: %d", f.Severity)
	}
	if f.IacProvider == nil || *f.IacProvider != "aws" {
		t.Fatalf("unexpected iac provider: %#v", f.IacProvider)
	}
	if f.CodeSnippet == nil || *f.CodeSnippet == "" {
		t.Fatalf("expected code snippet, got %#v", f.CodeSnippet)
	}
}

func TestCheckovParser_Parse_ArraySections(t *testing.T) {
	p := &CheckovParser{}
	findings, err := p.Parse(context.Background(), []byte(checkovArrayFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].FilePath != "deployment.yaml" {
		t.Fatalf("unexpected file path: %s", findings[0].FilePath)
	}
	if findings[0].LineStart != 4 || findings[0].LineEnd != 4 {
		t.Fatalf("expected fallback lines from results_configuration, got %d-%d", findings[0].LineStart, findings[0].LineEnd)
	}
}
