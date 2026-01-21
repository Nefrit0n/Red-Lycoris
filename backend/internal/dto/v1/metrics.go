package v1

type DashboardMetrics struct {
	TotalOpenFindings    int `json:"totalOpenFindings"`
	CriticalHighFindings int `json:"criticalHighFindings"`
	FixedThisWeek        int `json:"fixedThisWeek"`
	ProductsAtRisk       int `json:"productsAtRisk"`
}
