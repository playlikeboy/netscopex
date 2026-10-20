"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function OverviewPage() {
  const { data: monitors = [], isLoading: monitorsLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: api.getIncidents,
  });

  const { data: slos = [] } = useQuery({
    queryKey: ["slos"],
    queryFn: api.getSlos,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: api.getWorkers,
  });

  const activeMonitors = monitors.filter((m) => m.state === "active").length;
  const degradedMonitors = monitors.filter((m) => m.state === "degraded").length;
  const downMonitors = monitors.filter((m) => m.state === "down").length;
  const openIncidents = incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-500" />
          Reliability & Observability Overview
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time distributed probe metrics, incident states, and error budget consumption.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TOTAL MONITORS</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white font-mono">
            {monitors.length}
          </div>
          <div className="mt-2 text-xs flex gap-2">
            <span className="text-emerald-400 font-medium">{activeMonitors} Active</span>
            {degradedMonitors > 0 && (
              <span className="text-amber-400 font-medium">· {degradedMonitors} Degraded</span>
            )}
            {downMonitors > 0 && (
              <span className="text-rose-400 font-medium">· {downMonitors} Down</span>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ACTIVE INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono">
            <span className={openIncidents > 0 ? "text-rose-400" : "text-emerald-400"}>
              {openIncidents}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {openIncidents === 0
              ? "All monitored services healthy"
              : `${openIncidents} active incident(s) require attention`}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TRACKED SLOS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white font-mono">
            {slos.length}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Rolling availability & latency objectives
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PROBE WORKERS</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white font-mono">
            {workers.length}
          </div>
          <div className="mt-2 text-xs text-emerald-400">
            Heartbeats healthy (Lease queue active)
          </div>
        </div>
      </div>

      {/* Main Monitoring Section */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Monitored Service Endpoints</h2>
          <span className="text-xs font-mono text-slate-400">Auto-refresh: 5s live</span>
        </div>

        {monitorsLoading ? (
          <div className="text-slate-400 text-sm">Loading monitors...</div>
        ) : monitors.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center">
            No monitors configured. Create one in the Monitors tab.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {monitors.map((m) => (
              <div key={m.id} className="py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        m.state === "active"
                          ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                          : m.state === "degraded"
                          ? "bg-amber-500"
                          : m.state === "down"
                          ? "bg-rose-500 animate-pulse"
                          : "bg-slate-500"
                      }`}
                    />
                    <span className="font-medium text-white text-base">{m.name}</span>
                    <span className="text-xs bg-surface-raised px-2 py-0.5 rounded text-slate-300 font-mono">
                      {m.method}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                        m.state === "active"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : m.state === "degraded"
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : m.state === "down"
                          ? "bg-rose-950 text-rose-400 border border-rose-800"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {m.state}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {m.url} · Interval: {m.intervalSeconds}s · Timeout: {m.timeoutMs}ms
                  </div>
                  {m.stateReason && (
                    <div className="text-xs text-slate-300 mt-1 italic">
                      Reason: {m.stateReason}
                    </div>
                  )}
                </div>

                <div className="text-right font-mono text-xs text-slate-400">
                  <div>Region: {m.probeRegionPreference?.join(", ") || "us-east-local"}</div>
                  <div className="mt-1">
                    Last Checked:{" "}
                    {m.lastCheckedAt
                      ? new Date(m.lastCheckedAt).toLocaleTimeString()
                      : "Pending"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controlled Fault Demonstration Box */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Reliability & Fault-Injection Harness
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          NetScope X includes an isolated, controlled fault-injection testing endpoint suite.
          Inject latency, simulated outages, or transient flapping to observe state transitions,
          error budgets, and automatic incident lifecycle management without impacting production.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-surface-raised rounded border border-border">
            <strong className="text-white block mb-1">/fault/status?code=500</strong>
            <span className="text-slate-400">Triggers immediate HTTP 500 error for outage testing.</span>
          </div>
          <div className="p-3 bg-surface-raised rounded border border-border">
            <strong className="text-white block mb-1">/fault/latency?ms=2500</strong>
            <span className="text-slate-400">Triggers latency regression & degraded threshold.</span>
          </div>
          <div className="p-3 bg-surface-raised rounded border border-border">
            <strong className="text-white block mb-1">/fault/flaky</strong>
            <span className="text-slate-400">Alternates 200/503 to verify transient flapping suppression.</span>
          </div>
          <div className="p-3 bg-surface-raised rounded border border-border">
            <strong className="text-white block mb-1">Worker Lease Reclaim</strong>
            <span className="text-slate-400">Automated stale lease recovery on worker restarts.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
