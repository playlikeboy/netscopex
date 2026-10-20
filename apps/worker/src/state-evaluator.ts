import {
  MonitorConfig,
  MonitorLifecycleState,
  ProbeResult,
} from "@netscopex/contracts";
import {
  MonitorRepository,
  IncidentRepository,
  NotificationRepository,
} from "@netscopex/database";
import { logger } from "@netscopex/observability";

export interface StateEvaluationContext {
  monitor: MonitorConfig;
  probeResult: ProbeResult;
  monitorRepo: MonitorRepository;
  incidentRepo: IncidentRepository;
  notifRepo: NotificationRepository;
}

export interface StateTransitionResult {
  previousState: MonitorLifecycleState;
  newState: MonitorLifecycleState;
  stateReason: string;
  incidentTriggered: boolean;
  incidentResolved: boolean;
}

export async function evaluateMonitorStateTransition(
  ctx: StateEvaluationContext
): Promise<StateTransitionResult> {
  const { monitor, probeResult, monitorRepo, incidentRepo, notifRepo } = ctx;

  if (monitor.state === "paused") {
    return {
      previousState: "paused",
      newState: "paused",
      stateReason: "Monitor is paused by user",
      incidentTriggered: false,
      incidentResolved: false,
    };
  }

  const previousState = monitor.state;
  let newState = previousState;
  let stateReason = monitor.stateReason || "";
  let incidentTriggered = false;
  let incidentResolved = false;

  let consecutiveFailures = monitor.consecutiveFailures;
  let consecutiveSuccesses = monitor.consecutiveSuccesses;
  let consecutiveDegraded = monitor.consecutiveDegraded;

  if (!probeResult.success) {
    // Failure handling
    consecutiveFailures += 1;
    consecutiveSuccesses = 0;
    consecutiveDegraded = 0;

    if (consecutiveFailures >= monitor.downThresholdCount) {
      newState = "down";
      stateReason = `Service down: ${consecutiveFailures} consecutive probe failures (${probeResult.error?.message || "Unknown error"})`;

      // Trigger or update incident
      const activeIncident = await incidentRepo.findActiveByMonitor(monitor.id);
      if (!activeIncident) {
        const incident = await incidentRepo.create({
          projectId: monitor.projectId,
          monitorId: monitor.id,
          title: `Outage Detected: ${monitor.name} is DOWN`,
          severity: "CRITICAL",
          consecutiveFailureCount: consecutiveFailures,
          rootCauseSummary: probeResult.error?.message,
          lastProbeResultId: probeResult.id,
        });
        incidentTriggered = true;
        logger.warn({ monitorId: monitor.id, incidentId: incident.id }, "Incident triggered for down monitor");

        // Send alert notifications
        await sendAlerts(monitor.projectId, incident.id, incident.title, notifRepo);
      } else {
        await incidentRepo.addEvent(activeIncident.id, "PROBE_FAILED", {
          statusCode: probeResult.statusCode,
          error: probeResult.error,
          timing: probeResult.timing,
        });
      }
    } else {
      // Degraded transient state
      newState = "degraded";
      stateReason = `Transient failure detected (${consecutiveFailures} of ${monitor.downThresholdCount} before DOWN)`;
    }
  } else {
    // Success handling
    consecutiveFailures = 0;
    const isHighLatency =
      probeResult.timing.totalDurationMs >= monitor.degradedLatencyThresholdMs;

    if (isHighLatency) {
      consecutiveDegraded += 1;
      consecutiveSuccesses = 0;

      if (consecutiveDegraded >= monitor.degradedThresholdCount) {
        newState = "degraded";
        stateReason = `Latency regression: ${consecutiveDegraded} consecutive checks exceeded threshold (${probeResult.timing.totalDurationMs.toFixed(0)}ms >= ${monitor.degradedLatencyThresholdMs}ms)`;
      }
    } else {
      consecutiveDegraded = 0;
      consecutiveSuccesses += 1;

      if (
        previousState === "down" ||
        previousState === "degraded" ||
        previousState === "recovering"
      ) {
        if (consecutiveSuccesses < monitor.recoveryThresholdCount) {
          newState = "recovering";
          stateReason = `Service recovering: ${consecutiveSuccesses} of ${monitor.recoveryThresholdCount} healthy checks verified`;

          const activeIncident = await incidentRepo.findActiveByMonitor(monitor.id);
          if (activeIncident) {
            await incidentRepo.addEvent(activeIncident.id, "RECOVERY_DETECTED", {
              consecutiveSuccesses,
              timing: probeResult.timing,
            });
          }
        } else {
          // Fully recovered!
          newState = "active";
          stateReason = `Service fully healthy after ${consecutiveSuccesses} consecutive successful checks`;

          const activeIncident = await incidentRepo.findActiveByMonitor(monitor.id);
          if (activeIncident) {
            await incidentRepo.resolve(
              activeIncident.id,
              "NetScope Auto-Recovery System",
              `Service verified healthy after ${consecutiveSuccesses} consecutive successful checks`
            );
            incidentResolved = true;
            logger.info({ monitorId: monitor.id, incidentId: activeIncident.id }, "Incident auto-resolved");
          }
        }
      } else if (previousState === "unknown") {
        newState = "active";
        stateReason = "Service healthy and active";
      }
    }
  }

  // Persist monitor state update
  await monitorRepo.updateState(
    monitor.id,
    newState,
    stateReason,
    {
      consecutiveFailures,
      consecutiveSuccesses,
      consecutiveDegraded,
    },
    new Date(probeResult.executedAt)
  );

  return {
    previousState,
    newState,
    stateReason,
    incidentTriggered,
    incidentResolved,
  };
}

async function sendAlerts(
  projectId: string,
  incidentId: string,
  title: string,
  notifRepo: NotificationRepository
): Promise<void> {
  const channels = await notifRepo.listByProject(projectId);
  for (const channel of channels) {
    const idempotencyKey = `alert_${incidentId}_${channel.id}`;
    // Mock delivery attempt with idempotency key
    try {
      await notifRepo.recordDeliveryAttempt(
        channel.id,
        incidentId,
        idempotencyKey,
        "SENT"
      );
      logger.info({ channelId: channel.id, incidentId }, "Notification dispatched to channel");
    } catch (err: any) {
      await notifRepo.recordDeliveryAttempt(
        channel.id,
        incidentId,
        idempotencyKey,
        "FAILED",
        err.message
      );
    }
  }
}
