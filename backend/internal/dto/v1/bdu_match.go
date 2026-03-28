package v1

// BDUMatchDTO represents a matched BDU vulnerability for an SBOM component.
type BDUMatchDTO struct {
	ComponentName    string `json:"componentName"`
	ComponentVersion string `json:"componentVersion"`

	BDUID           string `json:"bduId"`
	Name            string `json:"name"`
	Severity        string `json:"severity"`
	CVSSV3          string `json:"cvssV3"`
	SoftwareName    string `json:"softwareName"`
	SoftwareVersion string `json:"softwareVersion"`
	ExploitExists   string `json:"exploitExists"`
	CWEID           string `json:"cweId"`
	Status          string `json:"status"`
	VulnClass       string `json:"vulnClass"`
	Vendor          string `json:"vendor"`
	Remediation     string `json:"remediation"`
	PublishedDate   string `json:"publishedDate"`
}
