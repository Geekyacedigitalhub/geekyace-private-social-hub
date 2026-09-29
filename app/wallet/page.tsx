"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronRight, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";

type Provider={name:string;enabled:boolean;mappings:number;activeMappings:number;health:string;latencyMs:number|null};
type Balance={name:string;balance:number|null;currency:string;status:"healthy"|"down"|"loading";error?:string;serviceCount?:number;latencyMs?:number};

const providers=["TaskletPay","Shoprime","ClassySMM","PawaBoost","Caryvn","Really Simple Social"];

export default function WalletPage(){
 const [rows,setRows]=useState<Provider[]>([]),[balances,setBalances]=useState<Record<string,Balance>>({}),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 async function load(){
  setRefreshing(true);
  try{
   const r=await fetch("/api/providers/health?limit=200",{cache:"no-store"}); const d=await r.json();
   if(r.ok)setRows(d.providers??[]);
  }finally{setLoading(false);setRefreshing(false)}
 }
 async function check(name:string){
  setBalances(x=>({...x,[name]:{name,balance:null,currency:"",status:"loading"}}));
  try{
   const r=await fetch("/api/providers/health?provider="+encodeURIComponent(name),{method:"POST",headers:{"Content-Type":"application/json"}});
   const d=await r.json();
   setBalances(x=>({...x,[name]:r.ok?{name,balance:Number(d.balance),currency:d.currency??"USD",status:"healthy",serviceCount:d.serviceCount,latencyMs:d.latencyMs}:{name,balance:null,currency:"",status:"down",error:d.error??"Health check failed"}}));
  }catch{setBalances(x=>({...x,[name]:{name,balance:null,currency:"",status:"down",error:"Connection failed"}}))}
 }
 async function checkAll(){await Promise.allSettled(providers.map(check));await load()}
 useEffect(()=>{void load()},[]);
 const healthy=rows.filter(x=>x.health==="healthy").length;
 const enabled=rows.filter(x=>x.enabled).length;
 const available=Object.values(balances).filter(x=>x.status==="healthy"&&x.balance!=null);
 const byCurrency=useMemo(()=>available.reduce<Record<string,number>>((a,x)=>{a[x.currency]=(a[x.currency]??0)+(x.balance??0);return a},{}),[available]);
 return <main className="gx-page min-h-screen"><div className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8 lg:py-8">
  <div className="flex items-center gap-2 text-xs text-slate-500"><Link href="/" className="hover:text-emerald-600">Dashboard</Link><ChevronRight size={13}/><span className="font-medium text-slate-700">Wallet</span></div>
  <header className="mt-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-600"><WalletCards size={13}/> Finance</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Wallet</h1><p className="mt-2 text-sm text-slate-500">Monitor the balances available across your connected SMM providers.</p></div><button onClick={()=>void checkAll()} disabled={refreshing} className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"><RefreshCw size={14} className={refreshing?"animate-spin":""}/> Check all balances</button></header>

  <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <div className="gx-card rounded-2xl p-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Connected providers</p><p className="mt-2 text-2xl font-bold text-slate-900">{enabled}</p><p className="mt-1 text-[11px] text-slate-400">Enabled in routing</p></div>
   <div className="gx-card rounded-2xl p-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Healthy</p><p className="mt-2 text-2xl font-bold text-emerald-600">{healthy}</p><p className="mt-1 text-[11px] text-slate-400">Latest health checks</p></div>
   <div className="gx-card rounded-2xl p-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Balances checked</p><p className="mt-2 text-2xl font-bold text-slate-900">{available.length}</p><p className="mt-1 text-[11px] text-slate-400">Provider accounts</p></div>
   <div className="gx-card rounded-2xl p-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Currencies</p><p className="mt-2 text-2xl font-bold text-slate-900">{Object.keys(byCurrency).length}</p><p className="mt-1 text-[11px] text-slate-400">Not converted across currencies</p></div>
  </section>

  <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
   <section className="gx-card overflow-hidden rounded-2xl">
    <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Provider balances</h2><p className="mt-1 text-[11px] text-slate-500">Balances come directly from provider APIs when you run a check.</p></div>
    <div className="divide-y divide-slate-100">{providers.map(name=>{const row=rows.find(x=>x.name===name);const b=balances[name];return <div key={name} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><WalletCards size={18}/></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{name}</p><p className="mt-1 text-[11px] text-slate-400">{row?.activeMappings??0} active services · {row?.health??"unknown"} · {row?.latencyMs!=null?row.latencyMs+"ms":"No recent latency"}</p></div></div>
      <div className="flex items-center gap-3"><div className="text-right">{b?.status==="loading"?<span className="text-xs text-slate-400">Checking...</span>:b?.status==="healthy"?<><b className="block text-lg text-slate-900">{b.balance?.toLocaleString(undefined,{maximumFractionDigits:4})} {b.currency}</b><span className="text-[10px] text-emerald-600">Live balance · {b.serviceCount??0} services</span></>:<span className="text-xs text-slate-400">{b?.error??"Not checked"}</span>}</div><button onClick={()=>void check(name)} disabled={b?.status==="loading"} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"><RefreshCw size={14} className={b?.status==="loading"?"animate-spin":""}/></button></div>
    </div>})}</div>
   </section>
   <aside className="space-y-5">
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-600"/><div><h3 className="text-xs font-bold text-slate-900">Provider wallet</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">This page monitors upstream provider balances. It does not invent or convert balances between currencies.</p></div></div></div>
    <div className="gx-card rounded-2xl p-5"><div className="flex items-center gap-2"><Activity size={15} className="text-emerald-600"/><h3 className="text-sm font-bold text-slate-900">Balance totals</h3></div>{Object.keys(byCurrency).length?<div className="mt-4 space-y-3">{Object.entries(byCurrency).map(([currency,total])=><div key={currency} className="flex justify-between border-b border-slate-100 pb-3 text-xs"><span className="text-slate-500">{currency}</span><b className="text-slate-900">{total.toLocaleString(undefined,{maximumFractionDigits:4})}</b></div>)}</div>:<p className="mt-4 text-xs text-slate-400">Run a balance check to populate totals.</p>}</div>
   </aside>
  </div>
 </div></main>
