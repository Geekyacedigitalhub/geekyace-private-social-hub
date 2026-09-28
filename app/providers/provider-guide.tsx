"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Gauge, RefreshCw, ShieldCheck } from "lucide-react";

type Coverage = {
  providerId: string; provider: string; platform: string; category: string;
  mappings: number; refillMappings: number; minPrice: number | null; maxPrice: number | null;
  examples: string[]; health: string; latencyMs: number | null; lastCheckedAt: string | null; refillPercent: number;
};

type GuideResponse = { platforms: string[]; categories: string[]; coverage: Coverage[] };

function money(value: number | null) {
  return value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function ProviderGuide() {
  const [data, setData] = useState<GuideResponse>({ platforms: [], categories: [], coverage: [] });
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platform) params.set("platform", platform);
      if (category) params.set("category", category);
      const response = await fetch("/api/providers/guide?" + params.toString(), { cache: "no-store" });
      if (response.ok) setData(await response.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [platform, category]);

  const groups = useMemo(() => {
    const map = new Map<string, Coverage[]>();
    for (const item of data.coverage) {
      const key = item.platform + "|" + item.category;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [data.coverage]);

  return (
    <section className="mt-5 gx-card rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <Gauge size={18} />
            <h2 className="font-semibold text-white">Provider Guide</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Pick a platform and service category before funding a provider. This shows where your current active catalog has matching services.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Filter size={12} /> Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none">
            <option value="">All platforms</option>
            {data.platforms.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none">
            <option value="">All categories</option>
            {data.categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] px-4 py-3 text-xs text-slate-400">
        <ShieldCheck className="mr-2 inline text-emerald-300" size={14} />
        A provider appears only when it currently has active catalog mappings for the selected platform/category. API health is shown separately.
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-500">Loading provider coverage...</p> : null}
      {!loading && !groups.length ? (
        <div className="mt-6 rounded-xl border border-amber-400/10 bg-amber-400/[0.03] p-4 text-sm text-amber-200">
          No active catalog mapping matches this selection.
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {groups.map(([key, items]) => {
          const [groupPlatform, groupCategory] = key.split("|");
          return (
            <div key={key}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{groupPlatform} · {groupCategory}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{items.length} provider{items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((item) => (
                  <div key={item.providerId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.provider}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.mappings} matching service{item.mappings === 1 ? "" : "s"} · {item.refillPercent}% support refill</p>
                      </div>
                      <span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase " +
                        (item.health === "healthy" ? "bg-emerald-400/10 text-emerald-300" :
                         item.health === "degraded" ? "bg-amber-400/10 text-amber-300" :
                         item.health === "down" ? "bg-red-400/10 text-red-300" : "bg-slate-400/10 text-slate-400")}>
                        {item.health}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-slate-600">Rate / 1K</p><p className="mt-1 font-semibold text-slate-200">{money(item.minPrice)} – {money(item.maxPrice)}</p></div>
                      <div><p className="text-slate-600">Response</p><p className="mt-1 font-semibold text-slate-200">{item.latencyMs == null ? "—" : item.latencyMs + " ms"}</p></div>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-600">{item.examples.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
