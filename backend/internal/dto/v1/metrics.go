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

type RiskBandCounts struct {
	Low      int `json:"low"`
	Medium   int `json:"medium"`
	High     int `json:"high"`
	Critical int `json:"critical"`
}

type RiskTopFinding struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Severity  string  `json:"severity"`
	RiskScore float64 `json:"riskScore"`
	RiskBand  string  `json:"riskBand"`
	ProductID *string `json:"productId,omitempty"`
}

type RiskTrendPoint struct {
	Date          string  `json:"date"`
	AverageRisk   float64 `json:"avgRisk"`
	CriticalCount int     `json:"criticalCount"`
}

type RiskMetricsDTO struct {
	Bands       RiskBandCounts   `json:"bands"`
	TopFindings []RiskTopFinding `json:"topFindings"`
	Trend       []RiskTrendPoint `json:"trend,omitempty"`
}

// Dashboard Metrics types
type SeverityCount struct {
	Severity string `json:"severity"`
	Count    int    `json:"count"`
}

type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type TrendPoint struct {
	Date     string `json:"date"`
	Total    int    `json:"total"`
	Critical int    `json:"critical"`
	High     int    `json:"high"`
	Medium   int    `json:"medium"`
	Low      int    `json:"low"`
}

type ProductRisk struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Identifier    string `json:"identifier,omitempty"`
	FindingsCount int    `json:"findingsCount"`
	CriticalCount int    `json:"criticalCount"`
	HighCount     int    `json:"highCount"`
}

type RecentActivityItem struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Severity    string `json:"severity,omitempty"`
	Timestamp   string `json:"timestamp"`
}

type DashboardDataDTO struct {
	Metrics              DashboardMetrics     `json:"metrics"`
	SeverityDistribution []SeverityCount      `json:"severityDistribution"`
	StatusDistribution   []StatusCount        `json:"statusDistribution"`
	Trend                []TrendPoint         `json:"trend"`
	TopProducts          []ProductRisk        `json:"topProducts"`
	RecentActivity       []RecentActivityItem `json:"recentActivity"`
}
