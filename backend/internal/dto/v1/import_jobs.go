package v1

type ImportJob struct {
	ID                string  `json:"id"`
	Scanner           string  `json:"scanner"`
	SourceType        *string `json:"sourceType,omitempty"`
	SourceVersion     *string `json:"sourceVersion,omitempty"`
	Status            string  `json:"status"`
	FindingsTotal     int     `json:"findingsTotal"`
	FindingsNew       int     `json:"findingsNew"`
	DuplicatesTotal   int     `json:"duplicatesTotal"`
	Checksum          string  `json:"checksum"`
	CreatedAt         string  `json:"createdAt"`
	StartedAt         *string `json:"startedAt,omitempty"`
	FinishedAt        *string `json:"finishedAt,omitempty"`
	ProductID         *string `json:"productId,omitempty"`
	ProductName       *string `json:"productName,omitempty"`
	ProductVersion    *string `json:"productVersion,omitempty"`
	ProductIdentifier *string `json:"productIdentifier,omitempty"`
	CreatedBy         *string `json:"createdBy,omitempty"`
	ErrorMessage      *string `json:"errorMessage,omitempty"`
}
