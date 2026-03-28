package v1

// BDUMatchDTO represents a matched BDU vulnerability for an SBOM component.
type BDUMatchDTO struct {
	ComponentName    string `json:"componentName"`
	ComponentVersion string `json:"componentVersion"`
	PackageName      string `json:"packageName,omitempty"`
	PackageVersion   string `json:"packageVersion,omitempty"`

	BDUID              string `json:"bduId"`
	Identifier         string `json:"identifier,omitempty"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Severity           string `json:"severity"`
	CVSSV2             string `json:"cvssV2"`
	CVSSV3             string `json:"cvssV3"`
	CVSSV4             string `json:"cvssV4"`
	SoftwareName       string `json:"softwareName"`
	SoftwareVersion    string `json:"softwareVersion"`
	SoftwareType       string `json:"softwareType"`
	OSHardware         string `json:"osHardware"`
	ExploitExists      string `json:"exploitExists"`
	CWEID              string `json:"cweId"`
	CWEDescription     string `json:"cweDescription"`
	CWEType            string `json:"cweType,omitempty"`
	Status             string `json:"status"`
	VulnState          string `json:"vulnState"`
	VulnClass          string `json:"vulnClass"`
	Vendor             string `json:"vendor"`
	Remediation        string `json:"remediation"`
	FixInfo            string `json:"fixInfo"`
	SourceURLs         string `json:"sourceUrls"`
	OtherIDs           string `json:"otherIds"`
	OtherInfo          string `json:"otherInfo"`
	IncidentInfo       string `json:"incidentInfo"`
	ExploitationMethod string `json:"exploitationMethod"`
	FixMethod          string `json:"fixMethod"`
	DetectionDate      string `json:"detectionDate"`
	PublishedDate      string `json:"publishedDate"`
	UpdatedDate        string `json:"updatedDate"`
	Consequences       string `json:"consequences"`
}
