"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Clock,
  Activity,
} from "lucide-react";

export default function SlosPage() {
  const { data: slos = [], isLoading } = useQuery({
    queryKey: ["slos"],
    queryFn: api.getSlos,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-emerald-400" />
          Service Level Objectives (SLOs) & Error Budgets
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Measurable reliability objectives, multi-window SLI evaluations, remaining error budget gauges, and fast/slow burn rate alerts.
        </p>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading SLOs...</div>
      ) : slos.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-slate-400">
          No SLOs defined. Create one via API or Seed script.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {slos.map((slo) => (
            <SloEvaluationCard key={slo.id} slo={slo} />
          ))}
        </div>
      )}
    </div>
  );
}

function SloEvaluationCard({ slo }: { slo: any }) {
  const { data: evalResult, isLoading } = useQuery({
    queryKey: ["slo-eval", slo.id],
    queryFn: () => api.evaluateSlo(slo.id),
  });

  if (isLoading || !evalResult) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="text-slate-400 text-xs">Evaluating {slo.name}...</div>
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
      </div>

      {isInsufficient ? (
        <div className="p-3 bg-slate-900/60 rounded border border-border text-xs text-slate-400">
          {evalResult.insufficientDataReason}
        </div>
      ) : (
        <>
          {/* SLI vs Target */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-surface-raised/40 p-3 rounded">
            <div>
              <span className="text-slate-400 block text-[11px]">CURRENT SLI</span>
              <strong className="text-xl text-white">
                {evalResult.sliPercent.toFixed(2)}%
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">SLO TARGET</span>
              <strong className="text-xl text-emerald-400">
                {evalResult.targetPercent.toFixed(2)}%
              </strong>
            </div>
          </div>

          {/* Error Budget Gauge */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">Error Budget Remaining:</span>
              <span className="font-bold text-white">{remaining.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  remaining > 50
                    ? "bg-emerald-500"
                    : remaining > 20
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${remaining}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Consumed: {evalResult.errorBudgetConsumedPercent}%</span>
              <span>Total Budget: {evalResult.errorBudgetTotalPercent}%</span>
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
