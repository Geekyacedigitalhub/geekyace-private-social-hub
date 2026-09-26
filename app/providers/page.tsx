"use client";

import { Activity, AlertTriangle, CheckCircle2, DatabaseZap, KeyRound, RefreshCw, ServerCog, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ProviderTest } from "./provider-test";
import { CatalogSync } from "./catalog-sync";

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
    <main className="min-h-screen bg-[#06100c]">
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
