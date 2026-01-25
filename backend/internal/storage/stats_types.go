package storage

// SeverityCounts — агрегат для виджетов/гейтов.
// Поля под твой текущий UI/стандартные severity.
type SeverityCounts struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Info     int `json:"info"`
	Unknown  int `json:"unknown"`
}

// CategoryCount — (category, count) для агрегаций.
type CategoryCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}
