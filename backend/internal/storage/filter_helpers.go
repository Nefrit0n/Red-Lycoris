package storage

import "strings"

func nilIfEmpty(s string) any {
	t := strings.TrimSpace(s)
	if t == "" {
		return nil
	}
	return t
}

// likePatternOrNil: "" -> nil, иначе "%...%" с экранированием спецсимволов LIKE.
// В Postgres '\' по умолчанию escape в LIKE/ILIKE.
func likePatternOrNil(s string) any {
	t := strings.TrimSpace(s)
	if t == "" {
		return nil
	}
	t = strings.ReplaceAll(t, `\`, `\\`)
	t = strings.ReplaceAll(t, `%`, `\%`)
	t = strings.ReplaceAll(t, `_`, `\_`)
	return "%" + t + "%"
}
