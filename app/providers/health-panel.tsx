"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

export function HealthPanel() {
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/providers/health", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Health check failed.");
      setResult("Healthy · " + data.latencyMs + "ms · " + data.serviceCount + " services · balance " + data.balance + " " + data.currency);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Health check failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex items-center gap-3"><Activity size={18} className="text-emerald-600" /><div><p className="font-semibold text-slate-900">Provider health</p><p className="text-xs text-slate-500">Check connectivity, latency, catalog availability, and balance.</p></div></div>
    <button onClick={() => void check()} disabled={busy} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Checking..." : "Run health check"}</button>
    {result ? <p className="mt-3 text-sm text-slate-600">{result}</p> : null}
  </div>;
}
