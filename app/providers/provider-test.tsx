"use client";

import { useState } from "react";

export function ProviderTest() {
  const [state, setState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function testProvider() {
    setState("testing");
    setMessage("");

    try {
      const response = await fetch("/api/providers/test", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        balance?: number;
        currency?: string;
        serviceCount?: number;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Provider connection failed.");
      }

      setState("success");
      setMessage(
        "Connected. " +
        String(data.serviceCount ?? 0) +
        " services available. Balance: " +
        String(data.balance ?? 0) +
        " " +
        String(data.currency ?? ""),
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Provider connection failed.");
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={testProvider}
        disabled={state === "testing"}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "testing" ? "Testing connection..." : "Test provider connection"}
      </button>
      {message ? (
        <p className={"mt-3 text-sm " + (state === "success" ? "text-emerald-700" : "text-rose-600")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
