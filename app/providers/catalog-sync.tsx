"use client";

import { useState } from "react";
import { CheckCircle2, DatabaseZap, XCircle } from "lucide-react";

export function CatalogSync() {
  const [state, setState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sync() {
    setState("syncing");
    setMessage("");
    try {
      const response = await fetch("/api/providers/catalog", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string; imported?: number; available?: number };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Catalog sync failed.");
      setState("success");
      setMessage("Catalog synced · " + String(data.imported ?? 0) + " imported · " + String(data.available ?? 0) + " available");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Catalog sync failed.");
    }
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={sync} disabled={state === "syncing"} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/[0.07] disabled:opacity-50">
        <DatabaseZap size={14} className={state === "syncing" ? "animate-pulse" : "text-cyan-300"} />
        {state === "syncing" ? "Syncing catalog..." : "Sync provider catalog"}
      </button>
      {message ? (
        <div className={"mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs " + (state === "success" ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300" : "border-rose-400/15 bg-rose-400/[0.05] text-rose-300")}>
          {state === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
