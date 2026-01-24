package metrics

import (
	"sync/atomic"
	"time"
)

var sbomIndexTotal int64
var sbomIndexFailedTotal int64
var sbomIndexDurationTotalMs int64
var sbomIndexLastDurationMs int64
var sbomIndexLastComponentCount int64

func RecordSbomIndexResult(duration time.Duration, componentCount int, err error) {
	atomic.AddInt64(&sbomIndexTotal, 1)
	if err != nil {
		atomic.AddInt64(&sbomIndexFailedTotal, 1)
	}
	if componentCount >= 0 {
		atomic.StoreInt64(&sbomIndexLastComponentCount, int64(componentCount))
	}
	durationMs := duration.Milliseconds()
	if durationMs < 0 {
		durationMs = 0
	}
	atomic.AddInt64(&sbomIndexDurationTotalMs, durationMs)
	atomic.StoreInt64(&sbomIndexLastDurationMs, durationMs)
}

func SbomIndexTotal() int64 {
	return atomic.LoadInt64(&sbomIndexTotal)
}

func SbomIndexFailedTotal() int64 {
	return atomic.LoadInt64(&sbomIndexFailedTotal)
}

func SbomIndexDurationTotalMs() int64 {
	return atomic.LoadInt64(&sbomIndexDurationTotalMs)
}

func SbomIndexLastDurationMs() int64 {
	return atomic.LoadInt64(&sbomIndexLastDurationMs)
}

func SbomIndexLastComponentCount() int64 {
	return atomic.LoadInt64(&sbomIndexLastComponentCount)
}
