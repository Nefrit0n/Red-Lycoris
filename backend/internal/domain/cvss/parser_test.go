package cvss

import "testing"

func TestParseV31(t *testing.T) {
	tests := []struct {
		name   string
		vector string
	}{
		{name: "log4shell-like", vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H"},
		{name: "local-lpe", vector: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ParseV31(tt.vector)
			if err != nil {
				t.Fatalf("ParseV31() error = %v", err)
			}
			if res.Raw != tt.vector || res.AV == "" || res.AC == "" || res.PR == "" || res.UI == "" || res.S == "" || res.C == "" || res.I == "" || res.A == "" {
				t.Fatalf("unexpected parse result: %#v", res)
			}
		})
	}
}

func TestParseV40(t *testing.T) {
	vector := "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N"
	res, err := ParseV40(vector)
	if err != nil {
		t.Fatalf("ParseV40() error = %v", err)
	}
	if res.Raw != vector || res.AT != "N" || res.VC != "H" || res.SA != "N" {
		t.Fatalf("unexpected parse result: %#v", res)
	}
}

func TestParseV2(t *testing.T) {
	tests := []string{
		"AV:N/AC:L/Au:N/C:P/I:P/A:P",
		"AV:L/AC:L/Au:N/C:C/I:C/A:C",
		"CVSS:2.0/AV:N/AC:M/Au:S/C:P/I:N/A:N",
	}

	for _, vector := range tests {
		res, err := ParseV2(vector)
		if err != nil {
			t.Fatalf("ParseV2(%q) error = %v", vector, err)
		}
		if res.Raw != vector || res.AV == "" || res.AC == "" || res.Au == "" || res.C == "" || res.I == "" || res.A == "" {
			t.Fatalf("unexpected parse result: %#v", res)
		}
	}
}

func TestParseErrors(t *testing.T) {
	tests := []struct {
		name string
		fn   func(string) error
	}{
		{name: "v31 empty", fn: func(v string) error { _, err := ParseV31(v); return err }},
		{name: "v40 bad prefix", fn: func(v string) error { _, err := ParseV40(v); return err }},
		{name: "v2 incomplete", fn: func(v string) error { _, err := ParseV2(v); return err }},
		{name: "v2 garbage", fn: func(v string) error { _, err := ParseV2(v); return err }},
	}

	vectors := []string{"", "CVSS:3.1/AV:N", "AV:N/AC:L", "garbage"}
	for i, tt := range tests {
		if err := tt.fn(vectors[i]); err == nil {
			t.Fatalf("%s: expected error", tt.name)
		}
	}
}

func TestParsePartialIgnoresGarbageSegments(t *testing.T) {
	v31 := "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/garbage"
	if _, err := ParseV31(v31); err != nil {
		t.Fatalf("ParseV31() unexpected error: %v", err)
	}

	v40 := "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N/garbage"
	if _, err := ParseV40(v40); err != nil {
		t.Fatalf("ParseV40() unexpected error: %v", err)
	}

	v2 := "AV:N/AC:L/Au:N/C:P/I:P/A:P/garbage"
	if _, err := ParseV2(v2); err != nil {
		t.Fatalf("ParseV2() unexpected error: %v", err)
	}
}
