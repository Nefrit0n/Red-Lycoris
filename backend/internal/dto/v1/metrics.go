package v1

type DashboardMetrics struct {
	TotalOpenFindings    int `json:"totalOpenFindings"`
	CriticalHighFindings int `json:"criticalHighFindings"`
	FixedThisWeek        int `json:"fixedThisWeek"`
	ProductsAtRisk       int `json:"productsAtRisk"`
}

type MetricsTimeSeriesPoint struct {
	Timestamp string `json:"timestamp"`
	Count     int    `json:"count"`
}

type MetricsTimeSeriesDTO struct {
	Interval string                   `json:"interval"`
	Series   []MetricsTimeSeriesPoint `json:"series"`
}

type MetricsSeverityBreakdownItem struct {
	Severity string `json:"severity"`
	Count    int    `json:"count"`
}

type MetricsCategoryBreakdownItem struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type MetricsBreakdownDTO struct {
	Severity []MetricsSeverityBreakdownItem `json:"severity"`
	Category []MetricsCategoryBreakdownItem `json:"category"`
}
