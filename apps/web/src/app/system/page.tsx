"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  Cpu,
  Server,
  Zap,
  Activity,
  CheckCircle2,
  Database,
  ExternalLink,
} from "lucide-react";

export default function SystemPage() {
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: api.getWorkers,
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Cpu className="w-6 h-6 text-teal-400" />
          Worker Cluster & Self-Observability
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Active distributed probe workers, geographic regions, lease heartbeats, and OpenTelemetry instrumentation metrics.
        </p>
      </div>

      {/* Cluster Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="bg-surface border border-border rounded-lg p-5">
          <span className="text-slate-400 text-xs block">POSTGRESQL CLUSTER</span>
          <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            {health?.database === "connected" ? "CONNECTED (ACID)" : "CHECKING"}
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Durable Lease Queue & Results
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <span className="text-slate-400 text-xs block">ACTIVE PROBE WORKERS</span>
          <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            {workers.length} Healthy Nodes
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Heartbeat timeout: 45s threshold
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <span className="text-slate-400 text-xs block">SELF-OBSERVABILITY EXPORT</span>
          <a
            href="http://localhost:4000/metrics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xl font-bold text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-2"
          >
            /metrics <ExternalLink className="w-4 h-4" />
          </a>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Prometheus text format v0.0.4
          </span>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-teal-400" />
          Registered Worker Nodes
        </h2>

        {workersLoading ? (
          <div className="text-xs text-slate-400">Loading worker cluster status...</div>
        ) : workers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">
            No probe workers actively sending heartbeats. Start worker via &quot;pnpm --filter=@netscopex/worker start&quot;.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-surface-raised text-slate-400 border-b border-border">
                <tr>
                  <th className="p-3">Worker ID</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Hostname</th>
                  <th className="p-3">Concurrency</th>
                  <th className="p-3">Active Jobs</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workers.map((w: any) => (
                  <tr key={w.workerId} className="hover:bg-surface-raised/20">
                    <td className="p-3 font-bold text-white">{w.workerId}</td>
                    <td className="p-3 text-cyan-400">{w.region}</td>
                    <td className="p-3 text-slate-400">{w.hostname}</td>
                    <td className="p-3 text-slate-300">{w.concurrency} slots</td>
                    <td className="p-3 text-slate-300">{w.activeJobs}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {w.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(w.lastHeartbeatAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
