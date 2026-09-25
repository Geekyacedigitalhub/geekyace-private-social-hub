"use client";

import { Activity, KeyRound, RefreshCw, ServerCog, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { ProviderTest } from "./provider-test";
import { CatalogSync } from "./catalog-sync";

type Settings={providerConfigured:boolean};
type Health={status:string;latencyMs?:number;balance?:number;currency?:string;serviceCount?:number};

export default function ProvidersPage() {
 const [settings,setSettings]=useState<Settings|null>(null); const [health,setHealth]=useState<Health|null>(null); const [checking,setChecking]=useState(false);
 async function load(){const [s,h]=await Promise.all([fetch("/api/settings",{cache:"no-store"}),fetch("/api/providers/health",{cache:"no-store"})]); setSettings(await s.json()); const d=await h.json(); setHealth(d.health?.[0] ? {status:d.health[0].status,latencyMs:d.health[0].responseTimeMs}:null);}
 async function check(){setChecking(true); try {const r=await fetch("/api/providers/health",{method:"POST"}); const d=await r.json(); setHealth(d); } finally {setChecking(false);}}
 useEffect(()=>{void load();},[]);
 const configured=Boolean(settings?.providerConfigured);
 return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-7xl p-5 sm:p-8">
  <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-emerald-600">Infrastructure</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Providers</h1><p className="mt-1 text-sm text-slate-500">Connection health, account balance and service catalog management.</p></div><button onClick={()=>void check()} disabled={checking} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={16} className={checking?"animate-spin":""}/> {checking?"Checking...":"Run health check"}</button></header>
  <section className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-5"><ServerCog className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Provider connection</p><p className={"mt-1 text-xl font-bold "+(configured?"text-emerald-700":"text-amber-700")}>{configured?"Configured":"Not configured"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><Activity className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Latest health</p><p className="mt-1 text-xl font-bold capitalize">{health?.status ?? "Unknown"}</p>{health?.latencyMs!=null?<p className="mt-1 text-xs text-slate-500">{health.latencyMs} ms response</p>:null}</div><div className="rounded-xl border border-slate-200 bg-white p-5"><KeyRound className="text-emerald-600" size={20}/><p className="mt-3 text-sm text-slate-500">Credentials</p><p className="mt-1 text-sm font-semibold text-emerald-700">Server-side only</p></div></section>
  <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600"/><div><h2 className="font-semibold text-slate-900">Connection test</h2><p className="text-xs text-slate-500">Verify credentials and provider availability.</p></div></div><ProviderTest/></div><div className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><ServerCog className="text-emerald-600"/><div><h2 className="font-semibold text-slate-900">Service catalog</h2><p className="text-xs text-slate-500">Import available services into your database.</p></div></div><CatalogSync/></div></section>
  <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><AlertTriangle className="text-amber-600"/><div><h2 className="font-semibold text-slate-900">Provider configuration</h2><p className="text-sm text-slate-500">API credentials are intentionally not editable from the browser. Configure them in the server environment.</p></div></div></section>
 </div></main>;
}
