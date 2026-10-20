"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useTelemetryStream } from "../../lib/use-telemetry-stream";
import {
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Clock,
  Activity,
  Plus,
  Trash2,
  Radio,
} from "lucide-react";

export default function SlosPage() {
  const queryClient = useQueryClient();
  const { isConnected: isLiveStreaming } = useTelemetryStream();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    monitorId: "",
    type: "AVAILABILITY",
    targetPercent: 99.5,
    window: "24h",
    latencyThresholdMs: 500,
    burnRateAlertThreshold: 14.4,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: slos = [], isLoading: slosLoading } = useQuery({
    queryKey: ["slos"],
    queryFn: api.getSlos,
  });

  const { data: monitors = [] } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      api.createSlo({
        projectId: "00000000-0000-0000-0000-000000000001",
        ...data,
      }),
    onSuccess: () => {
      setShowCreateModal(false);
      setFormData({
        name: "",
        monitorId: "",
        type: "AVAILABILITY",
        targetPercent: 99.5,
        window: "24h",
        latencyThresholdMs: 500,
        burnRateAlertThreshold: 14.4,
      });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["slos"] });
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create SLO");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSlo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slos"] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.monitorId) {
      setFormError("Please select a target monitor");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Service Level Objectives (SLOs) & Error Budgets
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Measurable reliability objectives, multi-window SLI evaluations, remaining error budget gauges, and fast/slow burn rate alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border ${
              isLiveStreaming
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                : "bg-slate-900 border-border text-slate-400"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? "animate-pulse text-emerald-400" : ""}`} />
            {isLiveStreaming ? "LIVE SLO SYNC" : "CONNECTING..."}
          </span>

          <button
            onClick={() => {
              if (monitors.length > 0 && !formData.monitorId) {
                setFormData((prev) => ({ ...prev, monitorId: monitors[0].id }));
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium transition shadow"
          >
            <Plus className="w-4 h-4" />
            Define SLO
          </button>
        </div>
      </div>

      {slosLoading ? (
        <div className="text-slate-400 text-sm">Loading SLOs...</div>
      ) : slos.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-slate-400 space-y-3">
          <p>No SLOs defined yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Create Your First Objective
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {slos.map((slo) => (
            <SloEvaluationCard
              key={slo.id}
              slo={slo}
              onDelete={() => {
                if (confirm(`Delete SLO objective "${slo.name}"?`)) {
                  deleteMutation.mutate(slo.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Create SLO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Define Service Level Objective (SLO)</h2>

            {formError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">SLO Objective Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Core API 99.5% Availability Target"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Target Health Monitor</label>
                <select
                  required
                  value={formData.monitorId}
                  onChange={(e) => setFormData({ ...formData, monitorId: e.target.value })}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="" disabled>Select a Monitor</option>
                  {monitors.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.url})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1">Objective Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="AVAILABILITY">Availability (Uptime)</option>
                    <option value="LATENCY">Latency Percentile</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Rolling Window</label>
                  <select
                    value={formData.window}
                    onChange={(e) => setFormData({ ...formData, window: e.target.value })}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="1h">1 Hour (Rapid)</option>
                    <option value="24h">24 Hours (Daily)</option>
                    <option value="7d">7 Days (Weekly)</option>
                    <option value="30d">30 Days (Monthly)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1">Target Compliance %</label>
                  <input
                    type="number"
                    step="0.01"
                    min={80}
                    max={99.999}
                    value={formData.targetPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, targetPercent: parseFloat(e.target.value) || 99.5 })
                    }
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {formData.type === "LATENCY" ? (
                  <div>
                    <label className="block text-slate-300 mb-1">Threshold (ms)</label>
                    <input
                      type="number"
                      min={50}
                      max={30000}
                      value={formData.latencyThresholdMs}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latencyThresholdMs: parseInt(e.target.value, 10) || 500,
                        })
                      }
                      className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-300 mb-1">Burn Rate Threshold</label>
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      max={50}
                      value={formData.burnRateAlertThreshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          burnRateAlertThreshold: parseFloat(e.target.value) || 14.4,
                        })
                      }
                      className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition"
                >
                  {createMutation.isPending ? "Validating & Creating..." : "Save SLO Objective"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SloEvaluationCard({ slo, onDelete }: { slo: any; onDelete?: () => void }) {
  const { data: evalResult, isLoading } = useQuery({
    queryKey: ["slo-eval", slo.id],
    queryFn: () => api.evaluateSlo(slo.id),
  });

  if (isLoading || !evalResult) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="text-slate-400 text-xs font-mono">Evaluating {slo.name}...</div>
      </div>
    );
  }

  const isCompliant = evalResult.status === "COMPLIANT";
  const isWarning = evalResult.status === "WARNING";
  const isBreached = evalResult.status === "BREACHED";
  const isInsufficient = evalResult.status === "INSUFFICIENT_DATA";

  const remaining = Math.max(0, Math.min(100, evalResult.errorBudgetRemainingPercent));

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
      {/* Title & Status */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-raised text-slate-400">
            {slo.type} · {slo.window} ROLLING
          </span>
          <h2 className="text-base font-bold text-white mt-1">{slo.name}</h2>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded font-mono uppercase font-bold ${
              isCompliant
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : isWarning
                ? "bg-amber-950 text-amber-400 border border-amber-800"
                : isBreached
                ? "bg-rose-950 text-rose-400 border border-rose-800"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {evalResult.status}
          </span>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-surface-raised transition"
              title="Delete SLO"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isInsufficient ? (
        <div className="p-3 bg-slate-900/60 rounded border border-border text-xs text-slate-400 font-mono">
          {evalResult.insufficientDataReason}
        </div>
      ) : (
        <>
          {/* SLI Compliance vs Target */}
          <div className="grid grid-cols-2 gap-4 bg-background/50 p-4 rounded border border-border/60">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Current SLI</span>
              <span
                className={`text-2xl font-bold font-mono ${
                  evalResult.sliPercent >= slo.targetPercent ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {evalResult.sliPercent.toFixed(2)}%
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Target SLO</span>
              <span className="text-2xl font-bold font-mono text-slate-200">
                {slo.targetPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Error Budget Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1 text-slate-300">
              <span>Remaining Error Budget</span>
              <strong className={remaining < 20 ? "text-rose-400" : "text-emerald-400"}>
                {remaining.toFixed(1)}%
              </strong>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  remaining > 50
                    ? "bg-emerald-500"
                    : remaining > 20
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${remaining}%` }}
              />
            </div>
          </div>

          {/* Burn Rate Alerts */}
          <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Burn Rate:</span>
              <strong className="text-white">{evalResult.burnRate}x</strong>
            </div>

            <div className="flex items-center gap-2">
              {evalResult.fastBurnDetected && (
                <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-bold animate-pulse">
                  FAST BURN ALERT (1h)
                </span>
              )}
              {evalResult.slowBurnDetected && !evalResult.fastBurnDetected && (
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
                  SLOW BURN (6h)
                </span>
              )}
              {!evalResult.fastBurnDetected && !evalResult.slowBurnDetected && (
                <span className="text-[10px] text-slate-500">Normal Consumption</span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono text-right">
            Sample volume: {evalResult.goodEvents} good / {evalResult.totalEvents} total checks
          </div>
        </>
      )}
    </div>
  );
}
