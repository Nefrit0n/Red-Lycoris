package metrics

import "sync"

var riskSchedulerMu sync.Mutex
var riskSchedulerEnqueued = map[string]int64{}

var riskComputeMu sync.Mutex
var riskComputeProcessed = map[string]int64{}

func RecordRiskSchedulerEnqueued(cause string, count int) {
	if count <= 0 {
		return
	}
	riskSchedulerMu.Lock()
	defer riskSchedulerMu.Unlock()
	riskSchedulerEnqueued[cause] += int64(count)
}

func RiskSchedulerEnqueuedTotal(cause string) int64 {
	riskSchedulerMu.Lock()
	defer riskSchedulerMu.Unlock()
	return riskSchedulerEnqueued[cause]
}

func RiskSchedulerEnqueuedAll() map[string]int64 {
	riskSchedulerMu.Lock()
	defer riskSchedulerMu.Unlock()
	copyMap := map[string]int64{}
	for key, value := range riskSchedulerEnqueued {
		copyMap[key] = value
	}
	return copyMap
}

func RecordRiskComputeProcessed(result string, count int) {
	if count <= 0 {
		return
	}
	riskComputeMu.Lock()
	defer riskComputeMu.Unlock()
	riskComputeProcessed[result] += int64(count)
}

func RiskComputeProcessedAll() map[string]int64 {
	riskComputeMu.Lock()
	defer riskComputeMu.Unlock()
	copyMap := map[string]int64{}
	for key, value := range riskComputeProcessed {
		copyMap[key] = value
	}
	return copyMap
}
