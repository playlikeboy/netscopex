"use client";

import React, { useState } from "react";

interface ProbeResultItem {
  id: string;
  statusCode: number | null;
  success: boolean;
  probeRegion: string;
  executedAt?: string;
  createdAt?: string;
  timing: {
    dnsLookupMs?: number;
    tcpConnectionMs?: number;
    tlsHandshakeMs?: number;
    ttfbMs?: number;
    contentDownloadMs?: number;
    totalDurationMs: number;
  };
}

interface LatencyChartProps {
  results: ProbeResultItem[];
  degradedThresholdMs?: number;
}

export function LatencyChart({
  results,
  degradedThresholdMs = 2000,
}: LatencyChartProps) {
  const [hoveredResult, setHoveredResult] = useState<ProbeResultItem | null>(null);

  if (!results || results.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-border rounded-lg">
        No probe samples recorded yet. Trigger a check to record telemetry.
      </div>
    );
  }

  // Oldest to newest for chronological left-to-right display
  const chronological = [...results].reverse();
  const maxRecorded = Math.max(...chronological.map((r) => r.timing.totalDurationMs || 0), 100);
  const chartHeight = 140;

  // Calculate percentiles
  const sortedDurations = [...chronological]
    .map((r) => r.timing.totalDurationMs)
    .sort((a, b) => a - b);
  const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
  const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
  const min = sortedDurations[0] || 0;
  const max = sortedDurations[sortedDurations.length - 1] || 0;

  return (
    <div className="space-y-3">
      {/* Metric summary pills */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            Min: <strong className="text-emerald-400">{min}ms</strong>
          </span>
          <span className="text-slate-400">
            p50: <strong className="text-sky-400">{p50}ms</strong>
          </span>
          <span className="text-slate-400">
            p95: <strong className="text-amber-400">{p95}ms</strong>
          </span>
          <span className="text-slate-400">
            Max: <strong className="text-rose-400">{max}ms</strong>
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Showing last <strong>{chronological.length}</strong> samples
        </div>
      </div>

      {/* SVG Time-Series Bars */}
      <div className="relative bg-background/80 border border-border rounded-lg p-4">
        {/* Threshold reference line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-rose-500/40 pointer-events-none"
          style={{
            bottom: `${Math.min(95, Math.max(5, (degradedThresholdMs / maxRecorded) * 100))}%`,
          }}
        >
          <span className="absolute right-2 -top-4 text-[10px] font-mono text-rose-400/80">
            Threshold: {degradedThresholdMs}ms
          </span>
        </div>

        <div className="h-32 flex items-end gap-1.5 pt-4">
          {chronological.map((item, idx) => {
            const duration = item.timing.totalDurationMs;
            const barHeightPct = Math.max(8, Math.min(100, (duration / maxRecorded) * 100));

            let barColor = "bg-emerald-500 hover:bg-emerald-400";
            if (!item.success) {
              barColor = "bg-rose-500 hover:bg-rose-400";
            } else if (duration > degradedThresholdMs) {
              barColor = "bg-amber-500 hover:bg-amber-400";
            }

            return (
              <div
                key={item.id || idx}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                onMouseEnter={() => setHoveredResult(item)}
                onMouseLeave={() => setHoveredResult(null)}
              >
                <div
                  className={`w-full rounded-t transition-all duration-150 ${barColor}`}
                  style={{ height: `${barHeightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Hover inspector panel */}
        {hoveredResult && (
          <div className="mt-3 p-3 bg-surface-raised border border-border rounded text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in">
            <div>
              <span className="text-slate-400 block text-[10px]">TIME</span>
              <span className="text-white">
                {new Date(hoveredResult.executedAt || hoveredResult.createdAt || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL / STATUS</span>
              <span
                className={`font-bold ${
                  hoveredResult.success ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hoveredResult.timing.totalDurationMs?.toFixed(1)}ms (HTTP {hoveredResult.statusCode || "ERR"})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">DNS / TCP / TLS</span>
              <span className="text-slate-300">
                {(hoveredResult.timing.dnsLookupMs || 0).toFixed(1)}ms /{" "}
                {(hoveredResult.timing.tcpConnectionMs || 0).toFixed(1)}ms /{" "}
                {(hoveredResult.timing.tlsHandshakeMs || 0).toFixed(1)}ms
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">TTFB / REGION</span>
              <span className="text-sky-300">
                {(hoveredResult.timing.ttfbMs || 0).toFixed(1)}ms ({hoveredResult.probeRegion})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
