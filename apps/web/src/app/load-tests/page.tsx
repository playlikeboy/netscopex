"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  Shield,
  Play,
  AlertOctagon,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function LoadTestsPage() {
  const [targetUrl, setTargetUrl] = useState("http://127.0.0.1:4000/fault/latency?ms=50");
  const [targetVUs, setTargetVUs] = useState(10);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [profile, setProfile] = useState("SMOKE");
  const [maxP95Ms, setMaxP95Ms] = useState(1000);
  const [maxErrorRate, setMaxErrorRate] = useState(5);

  const runMutation = useMutation({
    mutationFn: () =>
      api.runLoadTest({
        id: "00000000-0000-0000-0000-000000000001",
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "Controlled Safety Benchmark",
        targetUrl,
        profile,
        targetVUs,
        durationSeconds,
        rampUpSeconds: 2,
        maxAcceptableP95Ms: maxP95Ms,
        maxAcceptableErrorRatePercent: maxErrorRate,
        createdAt: new Date().toISOString(),
      }),
  });

  const result = runMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-rose-400" />
          Controlled & Bounded Load Testing
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Execute strictly bounded performance tests against authorized test targets with hard concurrency caps and safety circuit breakers.
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-4 text-xs font-mono text-rose-200 flex items-start gap-3">
        <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-rose-100 block mb-0.5">SRE Safety Constraints Active:</strong>
          Arbitrary target abuse is prevented. Max virtual users capped at 50 VUs, duration capped at 60s.
          If target error rate exceeds 50% during test execution, the automatic circuit breaker immediately aborts the test to prevent target denial-of-service.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4 text-xs font-mono">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Test Configuration</h2>

          <div>
            <label className="block text-slate-300 mb-1">Target URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Virtual Users (Max 50)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={targetVUs}
                onChange={(e) => setTargetVUs(Math.min(50, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Duration (Seconds, Max 60)</label>
              <input
                type="number"
                min={5}
                max={60}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Math.min(60, parseInt(e.target.value, 10) || 5))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Max Acceptable p95 (ms)</label>
              <input
                type="number"
                value={maxP95Ms}
                onChange={(e) => setMaxP95Ms(parseInt(e.target.value, 10) || 1000)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Max Error Rate (%)</label>
              <input
                type="number"
                value={maxErrorRate}
                onChange={(e) => setMaxErrorRate(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition flex items-center justify-center gap-2 shadow"
          >
            <Play className="w-4 h-4" />
            {runMutation.isPending ? "Executing Controlled Load Test..." : "Start Load Test"}
          </button>
        </div>

        {/* Results Drawer */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Benchmark Execution Results
          </h2>

          {!result ? (
            <div className="py-16 text-center text-slate-500 text-xs font-mono">
              {runMutation.isPending
                ? "Running concurrent virtual user threads... please wait."
                : "No benchmark run in progress. Configure parameters and click Start Load Test."}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertOctagon className="w-6 h-6 text-rose-400" />
                  )}
                  <span className="font-bold text-white text-base">
                    {result.passed ? "BENCHMARK PASSED CRITERIA" : "BENCHMARK FAILED THRESHOLD"}
                  </span>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded font-mono font-bold uppercase ${
                    result.passed
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      : "bg-rose-950 text-rose-300 border border-rose-800"
                  }`}
                >
                  {result.passed ? "PASS" : "FAIL"}
                </span>
              </div>

              {result.abortReason && (
                <div className="p-3 bg-rose-950 border border-rose-800 rounded text-xs text-rose-300 font-mono">
                  {result.abortReason}
                </div>
              )}

              {/* Quantiles and Throughput */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-surface-raised rounded border border-border">
                  <span className="text-slate-400 block text-[10px]">THROUGHPUT</span>
                  <strong className="text-lg text-white">{result.throughputRps} RPS</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Total: {result.totalRequests} reqs
                  </span>
                </div>

                <div className="p-3 bg-surface-raised rounded border border-border">
                  <span className="text-slate-400 block text-[10px]">ERROR RATE</span>
                  <strong
                    className={`text-lg ${
                      result.errorRatePercent > maxErrorRate ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {result.errorRatePercent}%
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Failed: {result.failedRequests}
                  </span>
                </div>

                <div className="p-3 bg-surface-raised rounded border border-border">
                  <span className="text-slate-400 block text-[10px]">p50 LATENCY</span>
                  <strong className="text-lg text-white">{result.p50Ms} ms</strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Median</span>
                </div>

                <div className="p-3 bg-surface-raised rounded border border-border">
                  <span className="text-slate-400 block text-[10px]">p95 LATENCY</span>
                  <strong
                    className={`text-lg ${
                      result.p95Ms > maxP95Ms ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {result.p95Ms} ms
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Max: {result.p99Ms} ms (p99)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
