"use client";

import { Activity, AlertTriangle, CheckCircle2, DatabaseZap, KeyRound, RefreshCw, ServerCog, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ProviderTest } from "./provider-test";
import { CatalogSync } from "./catalog-sync";
import { ProviderGuide } from "./provider-guide";

type Settings = { providerConfigured: boolean };
type Health = { status: string; latencyMs?: number };
type Provider = {
  name: string;
  enabled: boolean;
  mappings: number;
  activeMappings: number;
  health?: string;
  latencyMs?: number;
};

export default function ProvidersPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [bulkAction, setBulkAction] = useState<"testing" | "syncing" | null>(null);
  const [bulkMessage, setBulkMessage] = useState("");

  async function load() {
    const [settingsResponse, healthResponse] = await Promise.all([
      fetch("/api/settings", { cache: "no-store" }),
      fetch("/api/providers/health?limit=20", { cache: "no-store" }),
    ]);
    setSettings(await settingsResponse.json());
    const data = await healthResponse.json();
    setHealth(
      data.health?.[0]
        ? { status: data.health[0].status, latencyMs: data.health[0].responseTimeMs }
        : null,
    );
    setProviders(data.providers ?? []);
  }

  async function check() {
    setChecking(true);
    try {
      const response = await fetch("/api/providers/health", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setHealth({
          status: data.health?.status ?? data.status ?? "unknown",
          latencyMs: data.health?.responseTimeMs,
        });
      }
      await load();
    } finally {
      setChecking(false);
    }
  }

  async function testAllProviders() {
    const enabled = providers.filter((provider) => provider.enabled);
    if (!enabled.length) return;
    setBulkAction("testing");
    setBulkMessage("");
    try {
      const results = await Promise.allSettled(
        enabled.map(async (provider) => {
          const response = await fetch(
            "/api/providers/health?provider=" + encodeURIComponent(provider.name),
            { method: "POST" },
          );
          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error ?? "Health check failed.");
          }
          return provider.name;
        }),
      );
      const passed = results.filter((result) => result.status === "fulfilled").length;
      setBulkMessage("Health checks complete · " + passed + "/" + enabled.length + " providers passed");
      await load();
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Bulk health check failed.");
    } finally {
      setBulkAction(null);
    }
  }

  async function syncAllCatalogs() {
    const enabled = providers.filter((provider) => provider.enabled);
    if (!enabled.length) return;
    setBulkAction("syncing");
    setBulkMessage("");
    try {
      const results: Array<
        | { status: "fulfilled"; value: { name: string; imported: number } }
        | { status: "rejected"; reason: unknown }
      > = [];

      for (const provider of enabled) {
        let completed = false;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= 3 && !completed; attempt += 1) {
          try {
            const response = await fetch(
              "/api/providers/catalog?provider=" + encodeURIComponent(provider.name),
              { method: "POST" },
            );
            const data = await response.json();

            if (response.ok && data.ok) {
              results.push({
                status: "fulfilled",
                value: { name: provider.name, imported: Number(data.imported ?? 0) },
              });
              completed = true;
              continue;
            }

            lastError = new Error(data.error ?? "Catalog sync failed.");
            if (response.status === 429 && attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
              continue;
            }
            throw lastError;
          } catch (error) {
            lastError = error;
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
              continue;
            }
          }
        }

        if (!completed) {
          results.push({ status: "rejected", reason: lastError ?? new Error("Catalog sync failed.") });
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const passed = results.filter((result) => result.status === "fulfilled").length;
      const imported = results.reduce(
        (total, result) => total + (result.status === "fulfilled" ? result.value.imported : 0),
        0,
      );
      setBulkMessage("Catalog sync complete · " + passed + "/" + enabled.length + " providers · " + imported + " services imported");
      await load();
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Bulk catalog sync failed.");
    } finally {
      setBulkAction(null);
    }
  }

  async function syncProvider(name: string) {
    setSyncing(name);
    setSyncMessage("");
    try {
      const response = await fetch(
        "/api/providers/catalog?provider=" + encodeURIComponent(name),
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Catalog sync failed.");
      }
      setSyncMessage(name + " synced · " + String(data.imported ?? 0) + " services");
      await load();
    } catch (error) {
      setSyncMessage(
        name + " · " + (error instanceof Error ? error.message : "Catalog sync failed."),
      );
    } finally {
      setSyncing(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const configured = Boolean(settings?.providerConfigured);
  const enabledCount = providers.filter((provider) => provider.enabled).length;

  return (
    <main className="gx-page min-h-screen bg-[#f7f9f8]">
      <div className="mx-auto max-w-7xl p-5 sm:p-8 xl:p-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-400">
              <ServerCog size={13} /> Infrastructure
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Providers</h1>
            <p className="mt-2 text-sm text-slate-500">
              Connection health, credentials and catalog synchronization.
            </p>
          </div>
          <button
            onClick={() => void check()}
            disabled={checking}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
            {checking ? "Checking..." : "Run health check"}
          </button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="gx-card rounded-2xl p-5">
            <ServerCog className="text-emerald-300" size={19} />
            <p className="mt-4 text-xs text-slate-500">Provider connection</p>
            <p className={"mt-1 text-xl font-semibold " + (configured ? "text-emerald-300" : "text-amber-300")}>
              {configured ? "Configured" : "Not configured"}
            </p>
          </div>
          <div className="gx-card rounded-2xl p-5">
            <Activity className="text-cyan-300" size={19} />
            <p className="mt-4 text-xs text-slate-500">Latest health</p>
            <p className="mt-1 text-xl font-semibold capitalize text-white">{health?.status ?? "Unknown"}</p>
            {health?.latencyMs != null ? (
              <p className="mt-1 text-xs text-slate-600">{health.latencyMs} ms response</p>
            ) : null}
          </div>
          <div className="gx-card rounded-2xl p-5">
            <KeyRound className="text-emerald-300" size={19} />
            <p className="mt-4 text-xs text-slate-500">Credentials</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">Server-side only</p>
          </div>
        </section>

        <section className="mt-5 gx-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white">Provider routing pool</h2>
              <p className="mt-1 text-xs text-slate-600">
                Sync catalogs so Smart Auto can compare providers for the same service.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              {enabledCount} enabled
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void testAllProviders()}
              disabled={bulkAction !== null || enabledCount === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#06100c] disabled:opacity-40"
            >
              <CheckCircle2 size={14} />
              {bulkAction === "testing" ? "Testing all..." : "Test all providers"}
            </button>
            <button
              type="button"
              onClick={() => void syncAllCatalogs()}
              disabled={bulkAction !== null || enabledCount === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-40"
            >
              <DatabaseZap size={14} />
              {bulkAction === "syncing" ? "Syncing all..." : "Sync all catalogs"}
            </button>
          </div>
          {bulkMessage ? <p className="mt-3 text-xs text-emerald-300">{bulkMessage}</p> : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{provider.name}</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {provider.activeMappings} active mappings
                    </p>
                  </div>
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (provider.enabled ? "bg-emerald-400" : "bg-slate-600")
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void syncProvider(provider.name)}
                  disabled={syncing !== null || !provider.enabled}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40"
                >
                  <DatabaseZap size={13} />
                  {syncing === provider.name ? "Syncing..." : "Sync catalog"}
                </button>
              </div>
            ))}
          </div>
          {syncMessage ? <p className="mt-4 text-xs text-emerald-300">{syncMessage}</p> : null}
        </section>

        <ProviderGuide />

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="gx-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-300" />
              <div>
                <h2 className="font-semibold text-white">Connection test</h2>
                <p className="text-xs text-slate-600">Verify credentials and availability.</p>
              </div>
            </div>
            <ProviderTest />
          </div>

          <div className="gx-card rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <Zap className="text-cyan-300" />
              <div>
                <h2 className="font-semibold text-white">Service catalog</h2>
                <p className="text-xs text-slate-600">Import provider services into your catalog.</p>
              </div>
            </div>
            <CatalogSync />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-amber-400/10 bg-amber-400/[0.035] p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-300" />
            <div>
              <h2 className="font-semibold text-white">Provider configuration</h2>
              <p className="mt-1 text-sm text-slate-500">
                API credentials are intentionally not editable from the browser. Configure them in the server environment.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
