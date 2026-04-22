package cvss

import (
	"fmt"
	"strings"
)

type V31Metrics struct {
	Raw string `json:"raw"`
	AV  string `json:"AV"`
	AC  string `json:"AC"`
	PR  string `json:"PR"`
	UI  string `json:"UI"`
	S   string `json:"S"`
	C   string `json:"C"`
	I   string `json:"I"`
	A   string `json:"A"`
}

type V40Metrics struct {
	Raw string `json:"raw"`
	AV  string `json:"AV"`
	AC  string `json:"AC"`
	AT  string `json:"AT"`
	PR  string `json:"PR"`
	UI  string `json:"UI"`
	VC  string `json:"VC"`
	VI  string `json:"VI"`
	VA  string `json:"VA"`
	SC  string `json:"SC"`
	SI  string `json:"SI"`
	SA  string `json:"SA"`
}

type V2Metrics struct {
	Raw string `json:"raw"`
	AV  string `json:"AV"`
	AC  string `json:"AC"`
	Au  string `json:"Au"`
	C   string `json:"C"`
	I   string `json:"I"`
	A   string `json:"A"`
}

func ParseV31(vector string) (V31Metrics, error) {
	values, err := splitVector(vector, "CVSS:3.1")
	if err != nil {
		return V31Metrics{}, err
	}

	res := V31Metrics{
		Raw: vector,
		AV:  values["AV"],
		AC:  values["AC"],
		PR:  values["PR"],
		UI:  values["UI"],
		S:   values["S"],
		C:   values["C"],
		I:   values["I"],
		A:   values["A"],
	}
	if res.AV == "" || res.AC == "" || res.PR == "" || res.UI == "" || res.S == "" || res.C == "" || res.I == "" || res.A == "" {
		return V31Metrics{}, fmt.Errorf("invalid CVSS v3.1 vector %q: incomplete base metrics", vector)
	}

	return res, nil
}

func ParseV40(vector string) (V40Metrics, error) {
	values, err := splitVector(vector, "CVSS:4.0")
	if err != nil {
		return V40Metrics{}, err
	}

	res := V40Metrics{
		Raw: vector,
		AV:  values["AV"],
		AC:  values["AC"],
		AT:  values["AT"],
		PR:  values["PR"],
		UI:  values["UI"],
		VC:  values["VC"],
		VI:  values["VI"],
		VA:  values["VA"],
		SC:  values["SC"],
		SI:  values["SI"],
		SA:  values["SA"],
	}
	if res.AV == "" || res.AC == "" || res.AT == "" || res.PR == "" || res.UI == "" || res.VC == "" || res.VI == "" || res.VA == "" || res.SC == "" || res.SI == "" || res.SA == "" {
		return V40Metrics{}, fmt.Errorf("invalid CVSS v4.0 vector %q: incomplete base metrics", vector)
	}

	return res, nil
}

func ParseV2(vector string) (V2Metrics, error) {
	if strings.TrimSpace(vector) == "" {
		return V2Metrics{}, fmt.Errorf("invalid CVSS v2.0 vector %q: empty vector", vector)
	}

	parts := strings.Split(vector, "/")
	if len(parts) == 0 {
		return V2Metrics{}, fmt.Errorf("invalid CVSS v2.0 vector %q", vector)
	}

	startIdx := 0
	if parts[0] == "CVSS:2.0" {
		startIdx = 1
	}

	values := make(map[string]string, len(parts)-startIdx)
	for _, part := range parts[startIdx:] {
		if part == "" {
			continue
		}
		k, v, ok := strings.Cut(part, ":")
		if !ok || k == "" || v == "" {
			continue
		}
		values[k] = v
	}

	res := V2Metrics{
		Raw: vector,
		AV:  values["AV"],
		AC:  values["AC"],
		Au:  values["Au"],
		C:   values["C"],
		I:   values["I"],
		A:   values["A"],
	}
	if res.AV == "" || res.AC == "" || res.Au == "" || res.C == "" || res.I == "" || res.A == "" {
		return V2Metrics{}, fmt.Errorf("invalid CVSS v2.0 vector %q: incomplete base metrics", vector)
	}

	return res, nil
}

func splitVector(vector, expectedPrefix string) (map[string]string, error) {
	if strings.TrimSpace(vector) == "" {
		return nil, fmt.Errorf("invalid vector %q: empty vector", vector)
	}

	parts := strings.Split(vector, "/")
	if len(parts) == 0 || parts[0] != expectedPrefix {
		return nil, fmt.Errorf("invalid vector %q: expected prefix %s", vector, expectedPrefix)
	}

	values := make(map[string]string, len(parts)-1)
	for _, part := range parts[1:] {
		if part == "" {
			continue
		}
		k, v, ok := strings.Cut(part, ":")
		if !ok || k == "" || v == "" {
			continue
		}
		values[k] = v
	}

	return values, nil
}
