package metrics

import (
	"sync/atomic"
	"time"
)

var slaBreachUpdatedTotal int64
var slaBreachLastRunUpdated int64
var slaBreachLastRunUnix int64

func RecordSLABreachUpdate(updated int64, now time.Time) {
	if updated < 0 {
		return
	}
	atomic.AddInt64(&slaBreachUpdatedTotal, updated)
	atomic.StoreInt64(&slaBreachLastRunUpdated, updated)
	atomic.StoreInt64(&slaBreachLastRunUnix, now.Unix())
}

func SLABreachUpdatedTotal() int64 {
	return atomic.LoadInt64(&slaBreachUpdatedTotal)
}

func SLABreachLastRunUpdated() int64 {
	return atomic.LoadInt64(&slaBreachLastRunUpdated)
}

func SLABreachLastRunUnix() int64 {
	return atomic.LoadInt64(&slaBreachLastRunUnix)
}
