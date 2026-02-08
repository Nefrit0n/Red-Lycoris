package metrics

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func resetRiskMetrics() {
	riskSchedulerMu.Lock()
	riskSchedulerEnqueued = map[string]int64{}
	riskSchedulerMu.Unlock()

	riskComputeMu.Lock()
	riskComputeProcessed = map[string]int64{}
	riskComputeMu.Unlock()
}

func resetSbomMetrics() {
	atomic.StoreInt64(&sbomIndexTotal, 0)
	atomic.StoreInt64(&sbomIndexFailedTotal, 0)
	atomic.StoreInt64(&sbomIndexDurationTotalMs, 0)
	atomic.StoreInt64(&sbomIndexLastDurationMs, 0)
	atomic.StoreInt64(&sbomIndexLastComponentCount, 0)
}

func resetSLAMetrics() {
	atomic.StoreInt64(&slaBreachUpdatedTotal, 0)
	atomic.StoreInt64(&slaBreachLastRunUpdated, 0)
	atomic.StoreInt64(&slaBreachLastRunUnix, 0)
}

func TestRiskSchedulerMetrics(t *testing.T) {
	resetRiskMetrics()

	RecordRiskSchedulerEnqueued("manual", 2)
	RecordRiskSchedulerEnqueued("manual", 1)
	RecordRiskSchedulerEnqueued("manual", 0)
	RecordRiskSchedulerEnqueued("manual", -3)

	if total := RiskSchedulerEnqueuedTotal("manual"); total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}

	all := RiskSchedulerEnqueuedAll()
	if all["manual"] != 3 {
		t.Fatalf("expected manual count 3, got %d", all["manual"])
	}
	all["manual"] = 9
	if RiskSchedulerEnqueuedTotal("manual") != 3 {
		t.Fatal("expected snapshot map to be a copy")
	}
}

func TestRiskComputeProcessedMetrics(t *testing.T) {
	resetRiskMetrics()

	RecordRiskComputeProcessed("success", 5)
	RecordRiskComputeProcessed("success", -1)

	all := RiskComputeProcessedAll()
	if all["success"] != 5 {
		t.Fatalf("expected success count 5, got %d", all["success"])
	}
}

func TestSbomIndexMetrics(t *testing.T) {
	resetSbomMetrics()

	RecordSbomIndexResult(1200*time.Millisecond, 10, nil)
	RecordSbomIndexResult(-3*time.Millisecond, -1, errors.New("failed"))

	if total := SbomIndexTotal(); total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if failed := SbomIndexFailedTotal(); failed != 1 {
		t.Fatalf("expected failed total 1, got %d", failed)
	}
	if duration := SbomIndexDurationTotalMs(); duration != 1200 {
		t.Fatalf("expected duration total 1200, got %d", duration)
	}
	if lastDuration := SbomIndexLastDurationMs(); lastDuration != 0 {
		t.Fatalf("expected last duration 0, got %d", lastDuration)
	}
	if count := SbomIndexLastComponentCount(); count != 10 {
		t.Fatalf("expected last component count 10, got %d", count)
	}
}

func TestSLABreachMetrics(t *testing.T) {
	resetSLAMetrics()

	now := time.Unix(1710000000, 0)
	RecordSLABreachUpdate(3, now)
	RecordSLABreachUpdate(-1, now)

	if total := SLABreachUpdatedTotal(); total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if last := SLABreachLastRunUpdated(); last != 3 {
		t.Fatalf("expected last run updated 3, got %d", last)
	}
	if unix := SLABreachLastRunUnix(); unix != now.Unix() {
		t.Fatalf("expected last run unix %d, got %d", now.Unix(), unix)
	}
}
