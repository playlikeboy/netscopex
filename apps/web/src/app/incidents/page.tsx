"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  RotateCcw,
  FileText,
  UserCheck,
  CheckCheck,
} from "lucide-react";

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: api.getIncidents,
  });

  const { data: replayData } = useQuery({
    queryKey: ["incident-replay", selectedIncidentId],
    queryFn: () => (selectedIncidentId ? api.getIncidentReplay(selectedIncidentId) : null),
    enabled: !!selectedIncidentId,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.acknowledgeIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident-replay", selectedIncidentId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident-replay", selectedIncidentId] });
    },
  });

  const handleViewReport = async (id: string) => {
    const md = await api.getIncidentReport(id);
    setReportMarkdown(md);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          Incident Management & Replay Engine
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Full incident lifecycle tracking, operator acknowledgments, deterministic timeline replay, and automated postmortems.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border bg-surface-raised/40 font-semibold text-xs font-mono uppercase text-slate-300">
            Recorded Incidents ({incidents.length})
          </div>

          <div className="divide-y divide-border overflow-y-auto max-h-[700px]">
            {isLoading ? (
              <div className="p-4 text-xs text-slate-400">Loading incidents...</div>
            ) : incidents.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">No incidents recorded. All systems healthy.</div>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncidentId === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? "bg-surface-raised border-l-4 border-l-amber-500"
                        : "hover:bg-surface-raised/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold ${
                          inc.severity === "CRITICAL"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}
                      >
                        {inc.severity}
                      </span>

                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                          inc.status === "TRIGGERED"
                            ? "bg-rose-900/40 text-rose-300 animate-pulse"
                            : inc.status === "ACKNOWLEDGED"
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-emerald-900/40 text-emerald-300"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>

                    <div className="font-medium text-white text-sm mt-2">{inc.title}</div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      Triggered: {new Date(inc.triggeredAt).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Replay & Detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedIncidentId || !replayData ? (
            <div className="bg-surface border border-border rounded-lg p-12 text-center text-slate-400">
              Select an incident from the left to inspect timeline replay and postmortem report.
            </div>
          ) : (
            <>
              {/* Header Card */}
              <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-mono uppercase font-bold ${
                        replayData.incident.status === "TRIGGERED"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : replayData.incident.status === "ACKNOWLEDGED"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {replayData.incident.status}
                    </span>
                    <span className="text-sm font-mono text-slate-400">
                      Duration: {replayData.durationMinutes} min
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {replayData.incident.status === "TRIGGERED" && (
                      <button
                        onClick={() => ackMutation.mutate(replayData.incident.id)}
                        disabled={ackMutation.isPending}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-medium font-mono"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Acknowledge
                      </button>
                    )}

                    {replayData.incident.status !== "RESOLVED" && (
                      <button
                        onClick={() => resolveMutation.mutate(replayData.incident.id)}
                        disabled={resolveMutation.isPending}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-medium font-mono"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Resolve Incident
                      </button>
                    )}

                    <button
                      onClick={() => handleViewReport(replayData.incident.id)}
                      className="flex items-center gap-1.5 bg-surface-raised hover:bg-surface-raised/80 text-slate-200 border border-border px-3 py-1.5 rounded text-xs font-medium font-mono"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      View PIR Report
                    </button>
                  </div>
                </div>

                <h2 className="text-lg font-bold text-white mb-1">
                  {replayData.incident.title}
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Monitor ID: {replayData.incident.monitorId}
                </p>

                {replayData.incident.rootCauseSummary && (
                  <div className="mt-3 p-3 bg-surface-raised rounded text-xs text-slate-300">
                    <strong className="text-white block mb-0.5">Summary:</strong>
                    {replayData.incident.rootCauseSummary}
                  </div>
                )}
              </div>

              {/* Incident Replay View */}
              <div className="bg-surface border border-border rounded-lg p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-400" />
                  Incident Replay: Chronological Recorded Event Stream
                </h3>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {replayData.timeline.map((evt: any, idx: number) => (
                    <div key={evt.id || idx} className="relative">
                      <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-surface" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {evt.type}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-1 p-2.5 bg-surface-raised rounded text-xs font-mono text-slate-300">
                          {JSON.stringify(evt.payload, null, 2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Post-Incident Report Modal */}
      {reportMarkdown && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-lg max-w-3xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Post-Incident Report (PIR)
              </h2>
              <button
                onClick={() => setReportMarkdown(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap bg-background p-4 rounded border border-border">
              {reportMarkdown}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
