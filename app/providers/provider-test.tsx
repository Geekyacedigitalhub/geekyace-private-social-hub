"use client";

import { useState } from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

export function ProviderTest() {
  const [state, setState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function testProvider() {
    setState("testing");
    setMessage("");
    try {
      const response = await fetch("/api/providers/test", { method: "POST" });
      const data = (await response.json()) as { ok: boolean; error?: string; balance?: number; currency?: string; serviceCount?: number };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Provider connection failed.");
      setState("success");
      setMessage("Connected · " + String(data.serviceCount ?? 0) + " services · Balance " + String(data.balance ?? 0) + " " + String(data.currency ?? ""));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Provider connection failed.");
    }
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={testProvider} disabled={state === "testing"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#06100c] disabled:opacity-50">
        <Activity size={14} className={state === "testing" ? "animate-pulse" : ""} />
        {state === "testing" ? "Testing connection..." : "Test provider connection"}
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
