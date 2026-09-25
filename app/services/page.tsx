"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Filter, Layers3, Search, ShoppingCart } from "lucide-react";

type Service = {
  id: string;
  platform: string;
  name: string;
  min: number;
  max: number;
  serviceType?: string;
};

const serviceTypeLabels: Record<string, string> = {
  followers: "Followers",
  likes: "Likes",
  views: "Views",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  subscribers: "Subscribers",
  members: "Members",
  reactions: "Reactions",
  reposts: "Reposts",
  story_views: "Story Views",
  live_viewers: "Live Viewers",
  watch_time: "Watch Time",
  profile_visits: "Profile Visits",
  engagement: "Engagement",
  other: "Other",
};

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { services?: Service[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load services.");
        setRows(data.services ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load services."))
      .finally(() => setLoading(false));
  }, []);

  const availablePlatforms = useMemo(
    () => Array.from(new Set(rows.map((service) => service.platform))).sort(),
    [rows],
  );

  const availableTypes = useMemo(
    () => Array.from(new Set(rows.map((service) => service.serviceType ?? "other"))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((service) => {
      const matchesPlatform = platformFilter === "all" || service.platform === platformFilter;
      const matchesType = typeFilter === "all" || (service.serviceType ?? "other") === typeFilter;
      const matchesQuery =
        !needle ||
        service.name.toLowerCase().includes(needle) ||
        service.platform.toLowerCase().includes(needle) ||
        (service.serviceType ?? "other").toLowerCase().includes(needle);
      return matchesPlatform && matchesType && matchesQuery;
    });
  }, [platformFilter, query, rows, typeFilter]);

  return (
    <main className="min-h-screen bg-[#06100c]">
      <div className="mx-auto max-w-7xl p-5 sm:p-8 xl:p-10">
        <header>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-400"><Layers3 size={13}/> Catalog</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Services</h1>
          <p className="mt-2 text-sm text-slate-500">Provider services mapped into your private ordering catalog.</p>
        </header>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1b15] px-4">
            <Search size={16} className="text-slate-600"/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search services" placeholder="Search services, platforms or types..." className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"/>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0d1b15] px-4">
            <Filter size={14} className="text-slate-600"/>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} aria-label="Filter by platform" className="bg-transparent py-3 text-xs font-semibold text-slate-400 outline-none">
              <option value="all">All platforms</option>
              {availablePlatforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0d1b15] px-4">
            <Filter size={14} className="text-slate-600"/>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by service type" className="bg-transparent py-3 text-xs font-semibold text-slate-400 outline-none">
              <option value="all">All service types</option>
              {availableTypes.map((type) => <option key={type} value={type}>{serviceTypeLabels[type] ?? type}</option>)}
            </select>
          </label>
          <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-[#0d1b15] px-4 py-3 text-xs font-semibold text-slate-400">
            {filtered.length}{query || platformFilter !== "all" || typeFilter !== "all" ? " matching" : ""} services
          </div>
        </div>

        <section className="gx-card mt-4 overflow-hidden rounded-2xl">
          {loading ? <div className="p-12 text-center text-sm text-slate-600">Loading service catalog...</div> : error ? <div className="p-12 text-center text-sm text-rose-300">{error}</div> : !filtered.length ? (
            <div className="p-12 text-center">
              <Layers3 className="mx-auto text-emerald-400" size={28}/>
              <h2 className="mt-4 font-semibold text-white">{rows.length ? "No matching services" : "No services imported yet"}</h2>
              <p className="mt-2 text-sm text-slate-600">{rows.length ? "Try a different service, platform or service type." : "Sync the provider catalog from Providers first."}</p>
              {!rows.length ? <Link href="/providers" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#06100c]">Open Providers <ArrowUpRight size={13}/></Link> : null}
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_1.5fr_1fr_.8fr_.7fr] gap-4 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4 text-[10px] font-bold uppercase tracking-[.16em] text-slate-600 md:grid"><span>Platform</span><span>Service</span><span>Type</span><span>Range</span><span>Action</span></div>
              {filtered.map((service) => {
                const serviceType = service.serviceType ?? "other";
                return (
                  <div key={service.id} className="grid gap-3 border-b border-white/[0.045] px-5 py-5 transition hover:bg-white/[0.025] md:grid-cols-[1fr_1.5fr_1fr_.8fr_.7fr] md:items-center">
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">{service.platform}</span>
                    <span><span className="block text-sm font-medium text-white">{service.name}</span><span className="mt-1 block text-[11px] text-slate-600">Available</span></span>
                    <span className="text-xs font-semibold text-slate-400">{serviceTypeLabels[serviceType] ?? serviceType}</span>
                    <span className="text-sm text-slate-400">{service.min.toLocaleString()} – {service.max.toLocaleString()}</span>
                    <Link href={"/new-order?serviceId="+encodeURIComponent(service.id)} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/15"><ShoppingCart size={13}/> Order <ArrowUpRight size={12}/></Link>
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
