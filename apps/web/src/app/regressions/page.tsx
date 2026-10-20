"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  TrendingDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Sliders,
} from "lucide-react";

export default function RegressionsPage() {
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("p95_latency");

  const { data: monitors = [] } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const activeMonitorId = selectedMonitorId || monitors[0]?.id || "";

  const { data: report, isLoading } = useQuery({
    queryKey: ["regression", activeMonitorId, selectedMetric],
    queryFn: () => (activeMonitorId ? api.getMonitorRegression(activeMonitorId, selectedMetric) : null),
    enabled: !!activeMonitorId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-purple-400" />
          Statistical Performance Regression Detection
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Detect meaningful latency and error regressions using statistical baseline comparisons and sample size validation.
        </p>
      </div>

      {/* Selector Controls */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Target Monitor</label>
          <select
            value={activeMonitorId}
            onChange={(e) => setSelectedMonitorId(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
          >
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.url})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Evaluated Metric</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
          >
            <option value="p50_latency">p50 Latency (Median)</option>
            <option value="p90_latency">p90 Latency</option>
            <option value="p95_latency">p95 Latency</option>
            <option value="p99_latency">p99 Latency (Tail)</option>
            <option value="failure_rate">Failure Rate (%)</option>
          </select>
        </div>
      </div>

      {/* Regression Results Card */}
      {isLoading || !report ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-slate-400">
          Computing statistical regression report...
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase">
                Regression Status · {report.metricName}
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                {report.isRegressed ? "Degradation Flagged" : "Stable Performance"}
              </h2>
            </div>

            <span
              className={`text-xs px-3 py-1 rounded font-mono font-bold uppercase ${
                report.isRegressed
                  ? "bg-rose-950 text-rose-300 border border-rose-800 animate-pulse"
                  : "bg-emerald-950 text-emerald-300 border border-emerald-800"
              }`}
            >
              {report.isRegressed ? "REGRESSION DETECTED" : "WITHIN TOLERANCE"}
            </span>
          </div>

          {/* Metric Comparison Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-raised p-4 rounded border border-border">
              <span className="text-xs text-slate-400 block font-mono">BASELINE VALUE</span>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {report.baselineValue} {report.metricName.includes("latency") ? "ms" : "%"}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Sample Count: N={report.baselineSampleCount}
              </span>
            </div>

            <div className="bg-surface-raised p-4 rounded border border-border">
              <span className="text-xs text-slate-400 block font-mono">COMPARISON VALUE (CURRENT)</span>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {report.comparisonValue} {report.metricName.includes("latency") ? "ms" : "%"}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Sample Count: N={report.comparisonSampleCount}
              </span>
            </div>

            <div className="bg-surface-raised p-4 rounded border border-border">
              <span className="text-xs text-slate-400 block font-mono">MEASURED DELTA</span>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  report.deltaPercent > 0
                    ? report.isRegressed
                      ? "text-rose-400"
                      : "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {report.deltaPercent > 0 ? `+${report.deltaPercent}%` : `${report.deltaPercent}%`}
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Statistical Confidence: {(report.confidenceLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-4 bg-background rounded border border-border text-xs font-mono leading-relaxed">
            <strong className="text-white block mb-1">Diagnostic Explanation:</strong>
            <span className="text-slate-300">{report.explanation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
