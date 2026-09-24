"use client";

import { useState } from "react";

export function CatalogSync() {
  const [state, setState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function syncCatalog() {
    setState("syncing");
    setMessage("");

    try {
      const response = await fetch("/api/providers/catalog", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        imported?: number;
        available?: number;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Catalog sync failed.");
      }

      setState("success");
      setMessage(
        "Imported " + String(data.imported ?? 0) +
        " of " + String(data.available ?? 0) + " provider services.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Catalog sync failed.");
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={syncCatalog}
        disabled={state === "syncing"}
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-60"
      >
        {state === "syncing" ? "Syncing catalog..." : "Sync service catalog"}
      </button>
      {message ? (
        <p className={"mt-2 text-sm " + (state === "success" ? "text-emerald-700" : "text-rose-600")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
