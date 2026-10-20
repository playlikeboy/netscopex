"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  Layers,
  Plus,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Search,
} from "lucide-react";

export default function MonitorsPage() {
  const queryClient = useQueryClient();
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    method: "GET",
    intervalSeconds: 30,
    timeoutMs: 5000,
    expectedStatusCodes: [200],
    degradedLatencyThresholdMs: 2000,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: monitors = [], isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["monitor-results", selectedMonitorId],
    queryFn: () => (selectedMonitorId ? api.getMonitorResults(selectedMonitorId, 15) : []),
    enabled: !!selectedMonitorId,
  });

  const { data: diagnosis } = useQuery({
    queryKey: ["monitor-diagnose", selectedMonitorId],
    queryFn: () => (selectedMonitorId ? api.diagnoseMonitor(selectedMonitorId) : null),
    enabled: !!selectedMonitorId,
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => api.triggerCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["monitor-results", selectedMonitorId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      api.createMonitor({
        projectId: "00000000-0000-0000-0000-000000000001",
        ...data,
      }),
    onSuccess: () => {
      setShowCreateModal(false);
      setFormData({
        name: "",
        url: "",
        method: "GET",
        intervalSeconds: 30,
        timeoutMs: 5000,
        expectedStatusCodes: [200],
        degradedLatencyThresholdMs: 2000,
      });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create monitor");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            Synthetic Health Monitors
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure HTTP synthetic checks, lifecycle thresholds, and inspect detailed timing telemetry.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition shadow"
        >
          <Plus className="w-4 h-4" />
          Create Monitor
        </button>
      </div>

      {/* Main Grid: Monitor List + Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border bg-surface-raised/40 font-semibold text-xs font-mono uppercase text-slate-300">
            Active Targets ({monitors.length})
          </div>

          <div className="divide-y divide-border overflow-y-auto max-h-[700px]">
            {isLoading ? (
              <div className="p-4 text-xs text-slate-400">Loading monitors...</div>
            ) : monitors.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">No monitors registered.</div>
            ) : (
              monitors.map((m) => {
                const isSelected = selectedMonitorId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMonitorId(m.id)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? "bg-surface-raised border-l-4 border-l-blue-500"
                        : "hover:bg-surface-raised/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{m.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono uppercase font-bold ${
                          m.state === "active"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : m.state === "degraded"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : m.state === "down"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {m.state}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-1 font-mono truncate">
                      {m.url}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>Every {m.intervalSeconds}s</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerMutation.mutate(m.id);
                        }}
                        disabled={triggerMutation.isPending}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <Play className="w-3 h-3" />
                        Run Check
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Telemetry & Inspector */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedMonitorId ? (
            <div className="bg-surface border border-border rounded-lg p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Search className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">No Monitor Selected</p>
              <p className="text-xs mt-1">Select a monitor from the left list to inspect network diagnostics and results.</p>
            </div>
          ) : (
            <>
              {/* Timing Breakdown Card */}
              <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Latest Probe Telemetry Breakdown
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {selectedMonitorId}
                  </span>
                </div>

                {results.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">
                    No probe executions collected yet. Click &quot;Run Check&quot; to execute immediate probe.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Latest Result Banner */}
                    {results[0] && (
                      <div className="p-4 rounded border border-border bg-surface-raised">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {results[0].success ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-rose-400" />
                            )}
                            <span className="font-semibold text-white">
                              {results[0].statusCode ? `HTTP ${results[0].statusCode}` : "Connection Failure"}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              (Region: {results[0].probeRegion})
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-400">
                            {new Date(results[0].executedAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Detailed Timing Gantt */}
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>Total Duration:</span>
                            <strong className="text-white">{results[0].timing?.totalDurationMs?.toFixed(1)} ms</strong>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/60">
                            <div className="p-2 bg-background/50 rounded">
                              <span className="text-slate-400 block text-[10px]">DNS LOOKUP</span>
                              <strong className="text-blue-400">{results[0].timing?.dnsLookupMs?.toFixed(1)}ms</strong>
                            </div>
                            <div className="p-2 bg-background/50 rounded">
                              <span className="text-slate-400 block text-[10px]">TCP CONNECT</span>
                              <strong className="text-cyan-400">{results[0].timing?.tcpConnectionMs?.toFixed(1)}ms</strong>
                            </div>
                            <div className="p-2 bg-background/50 rounded">
                              <span className="text-slate-400 block text-[10px]">TLS HANDSHAKE</span>
                              <strong className="text-purple-400">{results[0].timing?.tlsHandshakeMs?.toFixed(1)}ms</strong>
                            </div>
                            <div className="p-2 bg-background/50 rounded">
                              <span className="text-slate-400 block text-[10px]">TTFB</span>
                              <strong className="text-emerald-400">{results[0].timing?.ttfbMs?.toFixed(1)}ms</strong>
                            </div>
                            <div className="p-2 bg-background/50 rounded">
                              <span className="text-slate-400 block text-[10px]">DOWNLOAD</span>
                              <strong className="text-amber-400">{results[0].timing?.contentDownloadMs?.toFixed(1)}ms</strong>
                            </div>
                          </div>
                        </div>

                        {results[0].error && (
                          <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300 font-mono">
                            <strong>[{results[0].error.classification}]</strong> {results[0].error.message}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Historical Executions Table */}
                    <div className="mt-4">
                      <h3 className="text-xs font-mono uppercase text-slate-400 mb-2">
                        Recent Executions (Last 15)
                      </h3>
                      <div className="border border-border rounded overflow-hidden">
                        <table className="w-full text-xs font-mono text-left">
                          <thead className="bg-surface-raised text-slate-400 border-b border-border">
                            <tr>
                              <th className="p-2">Status</th>
                              <th className="p-2">Total Latency</th>
                              <th className="p-2">TTFB</th>
                              <th className="p-2">Region</th>
                              <th className="p-2">Executed At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {results.map((r) => (
                              <tr key={r.id} className="hover:bg-surface-raised/20">
                                <td className="p-2 font-bold">
                                  <span className={r.success ? "text-emerald-400" : "text-rose-400"}>
                                    {r.statusCode || "ERR"}
                                  </span>
                                </td>
                                <td className="p-2 text-white">{r.timing?.totalDurationMs?.toFixed(1)}ms</td>
                                <td className="p-2 text-slate-400">{r.timing?.ttfbMs?.toFixed(1)}ms</td>
                                <td className="p-2 text-slate-400">{r.probeRegion}</td>
                                <td className="p-2 text-slate-500">
                                  {new Date(r.executedAt).toLocaleTimeString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Root Cause Diagnosis Findings */}
              {diagnosis && (
                <div className="bg-surface border border-border rounded-lg p-6">
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Evidence-Based Root Cause Diagnosis
                  </h3>
                  <div className="text-xs text-slate-400 mb-3">
                    Category: <strong className="text-white">{diagnosis.category}</strong> (Confidence: {diagnosis.confidence})
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Observed Facts:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 font-mono">
                        {diagnosis.facts.map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Inferred Hypotheses:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400">
                        {diagnosis.hypotheses.map((h: string, i: number) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-300 block mb-1">Recommended Remediation:</span>
                      <ul className="list-disc pl-4 space-y-1 text-emerald-400">
                        {diagnosis.recommendedActions.map((a: string, i: number) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Monitor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Create New Health Monitor</h2>

            {formError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">Monitor Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Core API Gateway"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Endpoint URL (SSRF Protected)</label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/health"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1">HTTP Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="GET">GET</option>
                    <option value="HEAD">HEAD</option>
                    <option value="POST">POST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Interval (Seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={formData.intervalSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, intervalSeconds: parseInt(e.target.value, 10) || 30 })
                    }
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    min={500}
                    max={30000}
                    value={formData.timeoutMs}
                    onChange={(e) =>
                      setFormData({ ...formData, timeoutMs: parseInt(e.target.value, 10) || 5000 })
                    }
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Degraded Latency Threshold (ms)</label>
                  <input
                    type="number"
                    min={100}
                    max={30000}
                    value={formData.degradedLatencyThresholdMs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        degradedLatencyThresholdMs: parseInt(e.target.value, 10) || 2000,
                      })
                    }
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border rounded text-slate-300 hover:bg-surface-raised transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition"
                >
                  {createMutation.isPending ? "Validating & Creating..." : "Save Monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
