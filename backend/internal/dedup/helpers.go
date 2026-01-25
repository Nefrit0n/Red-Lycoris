package dedup

import (
	"encoding/json"
	"fmt"
)

// getString достаёт строку из:
// - map[string]any по цепочке ключей (m, "a", "b")
// - либо просто приводит первое значение к строке.
func getString(args ...any) string {
	if len(args) == 0 {
		return ""
	}

	// Паттерн: getString(map, "k1", "k2", ...)
	if len(args) >= 2 {
		if m, ok := args[0].(map[string]any); ok {
			cur := any(m)
			for i := 1; i < len(args); i++ {
				key, ok := args[i].(string)
				if !ok {
					return ""
				}
				obj, ok := cur.(map[string]any)
				if !ok {
					return ""
				}
				next, ok := obj[key]
				if !ok || next == nil {
					return ""
				}
				cur = next
			}
			return coerceString(cur)
		}
	}

	// Фолбэк: getString(value)
	return coerceString(args[0])
}

func coerceString(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case *string:
		if t == nil {
			return ""
		}
		return *t
	case []byte:
		return string(t)
	case json.RawMessage:
		return string(t)
	case fmt.Stringer:
		return t.String()
	default:
		// Без “умной магии”: строго предсказуемо для дедупа.
		return fmt.Sprintf("%v", v)
	}
}
