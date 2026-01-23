package v1

type ImportJobListItemDTO struct {
	ID                string  `json:"id"`
	TenantID          *string `json:"tenantId,omitempty"`
	Scanner           string  `json:"scanner"`
	SourceType        *string `json:"sourceType,omitempty"`
	SourceVersion     *string `json:"sourceVersion,omitempty"`
	Status            string  `json:"status"`
	Progress          int     `json:"progress"`
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
}

type ImportJobErrorSummary struct {
	Message string `json:"message"`
}

type ImportJobDetailDTO struct {
	ImportJobListItemDTO
	ErrorMessage *string                `json:"errorMessage,omitempty"`
	ErrorSummary *ImportJobErrorSummary `json:"errorSummary,omitempty"`
}

type ImportJob = ImportJobDetailDTO
