"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  Compass,
  Play,
  CheckCircle,
  AlertCircle,
  ArrowDown,
  Layers,
} from "lucide-react";

export default function JourneysPage() {
  const [journeyConfig, setJourneyConfig] = useState({
    id: "00000000-0000-0000-0000-000000000001",
    projectId: "00000000-0000-0000-0000-000000000001",
    name: "API Gateway -> Microservice User Checkout Flow",
    baseUrl: "http://127.0.0.1:4000",
    intervalSeconds: 300,
    steps: [
      {
        id: "step-1",
        name: "1. Health Pre-Check",
        method: "GET",
        path: "/health",
        assertions: [
          { type: "STATUS_CODE", target: "", expected: 200 },
          { type: "BODY_CONTAINS", target: "", expected: "netscopex-api" },
        ],
      },
      {
        id: "step-2",
        name: "2. Verify Cluster Readiness",
        method: "GET",
        path: "/ready",
        assertions: [
          { type: "STATUS_CODE", target: "", expected: 200 },
          { type: "LATENCY_LESS_THAN", target: "", expected: 500 },
        ],
      },
      {
        id: "step-3",
        name: "3. Verify Controlled Fault Handling",
        method: "GET",
        path: "/fault/status?code=200",
        assertions: [
          { type: "STATUS_CODE", target: "", expected: 200 },
        ],
      },
    ],
  });

  const runMutation = useMutation({
    mutationFn: () => api.runSyntheticJourney(journeyConfig),
  });

  const result = runMutation.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" />
            Synthetic User Journeys & Multi-Step Workflows
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Validate dependent multi-step transactions, extract session variables between steps, and pinpoint exact step failures.
          </p>
        </div>

        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition shadow"
        >
          <Play className="w-4 h-4" />
          {runMutation.isPending ? "Running Workflow..." : "Run Journey Now"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Steps Visualizer */}
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Workflow Steps Pipeline
          </h2>

          <div className="space-y-4">
            {journeyConfig.steps.map((step, idx) => (
              <div key={step.id} className="relative">
                <div className="p-4 bg-surface-raised rounded border border-border font-mono text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-2">
                    <span>{step.name}</span>
                    <span className="text-[10px] bg-background px-2 py-0.5 rounded text-indigo-400 border border-border">
                      {step.method} {step.path}
                    </span>
                  </div>

                  <div className="text-slate-400 space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 block">Assertions:</span>
                    {step.assertions.map((a, i) => (
                      <div key={i} className="text-[11px] text-slate-300">
                        • {a.type}: {a.target ? `${a.target} == ` : ""}
                        <strong className="text-emerald-400">{a.expected}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {idx < journeyConfig.steps.length - 1 && (
                  <div className="flex justify-center my-1">
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live Execution Output */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Execution Telemetry & Localization
          </h2>

          {!result ? (
            <div className="py-20 text-center text-slate-500 text-xs font-mono">
              {runMutation.isPending
                ? "Executing sequential HTTP requests with variable extraction..."
                : "Click 'Run Journey Now' to evaluate the multi-step transaction."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface-raised rounded border border-border">
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span className="font-bold text-white text-sm">
                    {result.passed ? "JOURNEY COMPLETED SUCCESSFULLY" : "JOURNEY FAILED AT STEP"}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Total: {result.totalDurationMs} ms
                </span>
              </div>

              {/* Per-step Results */}
              <div className="space-y-2">
                {result.steps.map((st: any, i: number) => (
                  <div
                    key={st.stepId || i}
                    className={`p-3 rounded border font-mono text-xs ${
                      st.passed
                        ? "bg-emerald-950/20 border-emerald-800/40"
                        : "bg-rose-950/40 border-rose-800"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{st.stepName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{st.durationMs}ms</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.passed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {st.passed ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                    </div>

                    {st.failureReason && (
                      <div className="mt-2 p-2 bg-rose-950 text-rose-300 rounded text-[11px]">
                        <strong>Failure Localization:</strong> {st.failureReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
