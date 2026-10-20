import "./globals.css";
import React from "react";
import { Providers } from "./providers";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Compass,
  Cpu,
  Layers,
  Shield,
  TrendingDown,
} from "lucide-react";

export const metadata = {
  title: "NetScope X — Distributed Observability & Reliability Platform",
  description: "Enterprise SRE & Observability Control Plane",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
        <Providers>
          {/* Header */}
          <header className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider shadow">
                NX
              </div>
              <span className="font-semibold text-lg tracking-tight text-white">
                NetScope <span className="text-blue-500 font-mono">X</span>
              </span>
              <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded font-mono">
                CONTROL PLANE v1.0
              </span>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <span className="flex items-center text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
                DISTRIBUTED PROBES ACTIVE
              </span>
              <span className="text-slate-400 border-l border-border pl-4">
                Org: <strong className="text-slate-200">Acme Corp</strong>
              </span>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-border bg-surface/50 p-4 flex flex-col justify-between shrink-0">
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span>Overview & Metrics</span>
                </Link>
                <Link
                  href="/monitors"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Monitors</span>
                </Link>
                <Link
                  href="/incidents"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Incidents & Replay</span>
                </Link>
                <Link
                  href="/slos"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>SLOs & Error Budgets</span>
                </Link>
                <Link
                  href="/regressions"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <TrendingDown className="w-4 h-4 text-purple-400" />
                  <span>Regression Detection</span>
                </Link>
                <Link
                  href="/load-tests"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <Shield className="w-4 h-4 text-rose-400" />
                  <span>Controlled Load Testing</span>
                </Link>
                <Link
                  href="/journeys"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <Compass className="w-4 h-4 text-indigo-400" />
                  <span>Synthetic Journeys</span>
                </Link>
                <Link
                  href="/system"
                  className="flex items-center space-x-3 px-3 py-2 rounded text-sm text-slate-300 hover:text-white hover:bg-surface-raised transition"
                >
                  <Cpu className="w-4 h-4 text-teal-400" />
                  <span>Workers & Telemetry</span>
                </Link>
              </nav>

              <div className="p-3 bg-surface-raised/40 rounded border border-border text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center mb-1">
                  <span>Engine:</span>
                  <span className="text-slate-200">TypeScript / Fastify</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Storage:</span>
                  <span className="text-slate-200">PostgreSQL 16 ACID</span>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 bg-background">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
