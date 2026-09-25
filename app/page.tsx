"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ClipboardList, Package, Plus, RefreshCw, ShieldCheck, Sparkles, XCircle, Zap } from "lucide-react";

type Stats={totalOrders:number;activeOrders:number;completedOrders:number;failedOrders:number;refillRecords:number;events:number;totalQuantity:number};
type Settings={privateMode:boolean;ownerEmailConfigured:boolean;providerConfigured:boolean;syncConfigured:boolean;environment:string};

export default function Dashboard(){
 const [stats,setStats]=useState<Stats|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const [a,b]=await Promise.all([fetch("/api/analytics",{cache:"no-store"}),fetch("/api/settings",{cache:"no-store"})]);setStats(await a.json());setSettings(await b.json());}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const metrics=[
  {label:"Total orders",value:stats?.totalOrders,icon:Package,accent:"from-emerald-400/20 to-transparent",note:"All time"},
  {label:"Active orders",value:stats?.activeOrders,icon:Activity,accent:"from-cyan-400/15 to-transparent",note:"In progress"},
  {label:"Completed",value:stats?.completedOrders,icon:CheckCircle2,accent:"from-teal-400/15 to-transparent",note:"Successfully fulfilled"},
  {label:"Failed",value:stats?.failedOrders,icon:XCircle,accent:"from-rose-400/10 to-transparent",note:"Needs attention"},
 ];
 const checks=[["Private access",settings?.privateMode],["Owner allowlist",settings?.ownerEmailConfigured],["Provider connection",settings?.providerConfigured],["Auto sync",settings?.syncConfigured]];
 return <main className="min-h-screen bg-[#06100c]">
  <div className="gx-grid min-h-screen">
   <div className="mx-auto max-w-[1480px] p-5 sm:p-8 xl:p-10">
    <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400"><Sparkles size={13}/> Command center</div><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-white sm:text-5xl">Your social operations,<br/><span className="bg-gradient-to-r from-white via-emerald-100 to-emerald-400 bg-clip-text text-transparent">under one roof.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">A private control center for provider-backed social service orders, monitoring and fulfillment.</p></div>
      <div className="flex items-center gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-50"><RefreshCw size={15} className={loading?"animate-spin":""}/> Refresh</button><Link href="/new-order" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#06100c] shadow-[0_10px_35px_rgba(52,211,153,.15)] transition hover:bg-emerald-300"><Plus size={16}/> New order</Link></div>
    </header>

    <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({label,value,icon:Icon,accent,note})=><div key={label} className={"gx-card gx-card-hover relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br "+accent}><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.045]"><Icon size={18} className="text-emerald-300"/></div><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600">{note}</span></div><p className="mt-7 text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-white">{value?.toLocaleString() ?? "—"}</p></div>)}
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
      <div className="gx-card relative overflow-hidden rounded-3xl p-6 sm:p-7"><div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-400/[0.06] blur-3xl"/><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-emerald-400"><BarChart3 size={17}/><span className="text-xs font-bold uppercase tracking-[.16em]">Operational pulse</span></div><h2 className="mt-2 text-xl font-semibold text-white">System activity at a glance</h2><p className="mt-1 text-xs text-slate-500">Live metrics from your private workspace.</p></div><Link href="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-emerald-300">Full analytics <ArrowUpRight size={14}/></Link></div><div className="relative mt-8 grid gap-6 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Quantity processed</p><p className="mt-2 text-2xl font-semibold text-white">{stats?.totalQuantity?.toLocaleString()??"—"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"/></div></div><div><p className="text-xs text-slate-500">Refill records</p><p className="mt-2 text-2xl font-semibold text-white">{stats?.refillRecords?.toLocaleString()??"—"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[46%] rounded-full bg-gradient-to-r from-cyan-500 to-emerald-300"/></div></div><div><p className="text-xs text-slate-500">Tracked events</p><p className="mt-2 text-2xl font-semibold text-white">{stats?.events?.toLocaleString()??"—"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[84%] rounded-full bg-gradient-to-r from-teal-500 to-emerald-300"/></div></div></div></div>
      <div className="gx-card rounded-3xl p-6 sm:p-7"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10"><ShieldCheck size={17} className="text-emerald-300"/></div><div><h2 className="text-sm font-semibold text-white">System pulse</h2><p className="text-[11px] text-slate-600">{settings?.environment ?? "production"} environment</p></div></div><div className="mt-6 space-y-3">{checks.map(([label,ready])=><div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.025] px-3.5 py-3"><span className="text-xs text-slate-400">{label}</span><span className={"inline-flex items-center gap-1.5 text-[11px] font-bold "+(ready?"text-emerald-400":"text-amber-400")}><span className={"h-1.5 w-1.5 rounded-full "+(ready?"gx-pulse bg-emerald-400":"bg-amber-400")}/>{ready?"Ready":"Pending"}</span></div>)}</div></div>
    </section>

    <section className="mt-5 grid gap-4 md:grid-cols-3">
      {[["Manage orders","Track provider progress, statuses and completed quantities.","/orders",ClipboardList],["Provider control","Test connectivity, sync services and inspect provider health.","/providers",Zap],["Security & settings","Review private access and deployment configuration.","/settings",ShieldCheck]].map(([title,desc,href,Icon])=><Link key={String(href)} href={String(href)} className="gx-card gx-card-hover group rounded-2xl p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.045] text-emerald-300"><Icon size={18}/></div><ArrowUpRight size={16} className="text-slate-700 transition group-hover:text-emerald-400"/></div><h3 className="mt-5 text-sm font-semibold text-white">{String(title)}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{String(desc)}</p></Link>)}
    </section>
   </div>
  </div>
 </main>;
}
