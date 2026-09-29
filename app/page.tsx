"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ClipboardList, Package, Plus, RefreshCw, ShieldCheck, Sparkles, XCircle, Zap, ShoppingCart, WalletCards } from "lucide-react";

type Stats={totalOrders:number;activeOrders:number;completedOrders:number;failedOrders:number;refillRecords:number;events:number;totalQuantity:number};
type RecentOrder={id:string;target:string;quantity:number;status:string;completedQuantity:number|null;createdAt:string};
type Settings={privateMode:boolean;ownerEmailConfigured:boolean;providerConfigured:boolean;syncConfigured:boolean;environment:string};

export default function Dashboard(){
 const [stats,setStats]=useState<Stats|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [recentOrders,setRecentOrders]=useState<RecentOrder[]>([]);
 const [loading,setLoading]=useState(true);

 const load=async()=>{
   setLoading(true);
   try{
     const [a,b,c]=await Promise.all([
       fetch("/api/analytics",{cache:"no-store"}),
       fetch("/api/settings",{cache:"no-store"}),
       fetch("/api/orders?limit=5",{cache:"no-store"})
     ]);
     setStats(await a.json());
     setSettings(await b.json());
     const orders=await c.json();
     setRecentOrders(orders.orders??[]);
   }finally{setLoading(false);}
 };

 useEffect(()=>{void load();},[]);

 const total=stats?.totalOrders??0;
 const completionRate=total?Math.round(((stats?.completedOrders??0)/total)*100):0;
 const activeRate=total?Math.round(((stats?.activeOrders??0)/total)*100):0;

 const metrics=[
  {label:"Total Orders",value:stats?.totalOrders,icon:Package,iconClass:"text-sky-300",bg:"bg-sky-400/10"},
  {label:"Completed",value:stats?.completedOrders,icon:CheckCircle2,iconClass:"text-emerald-300",bg:"bg-emerald-400/10"},
  {label:"Processing",value:stats?.activeOrders,icon:Activity,iconClass:"text-amber-300",bg:"bg-amber-400/10"},
  {label:"Cancelled / Failed",value:stats?.failedOrders,icon:XCircle,iconClass:"text-rose-300",bg:"bg-rose-400/10"},
 ];

 return <main className="min-h-screen bg-[#f7f9f8] text-slate-900">
  <div className="min-h-screen">
   <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">

    <header className="flex items-center justify-end gap-2">
      <button onClick={()=>void load()} disabled={loading} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:inline-flex">
        <RefreshCw size={14} className={loading?"animate-spin":""}/> Refresh
      </button>
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm">
        <WalletCards size={15} className="text-slate-500"/> $0.00
      </div>
      <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600">
        + Add Funds
      </Link>
    </header>

    <section className="relative mt-4 h-[154px] overflow-hidden rounded-2xl bg-[#063b2b] shadow-[0_12px_35px_rgba(6,45,33,.12)] sm:h-[154px]">
      <img src="/social-hero.svg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative z-10 flex h-full items-center px-8 sm:px-10">
        <div>
          <p className="text-[18px] font-medium leading-none text-white/95">Welcome to</p>
          <h2 className="mt-1 text-[32px] font-extrabold leading-none tracking-[-.045em] text-white sm:text-[36px]">GeekyAce <span className="text-[#19e6e2]">Social Hub</span></h2>
          <p className="mt-3 text-[15px] font-medium text-white/90">All Your Social Growth in One Place</p>
        </div>
      </div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({label,value,icon:Icon,iconClass,bg})=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={"grid h-11 w-11 place-items-center rounded-xl "+bg}><Icon size={20} className={iconClass}/></div>
          <div><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value?.toLocaleString()??"—"}</p></div>
        </div>
      </div>)}
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div><div className="flex items-center gap-2 text-emerald-600"><ShoppingCart size={16}/><span className="text-xs font-bold uppercase tracking-[.16em]">Quick Order</span></div><h2 className="mt-1 text-lg font-bold text-slate-900">Place a new order</h2><p className="mt-1 text-xs text-slate-500">Use the full New Order workspace for category, provider and service selection.</p></div>
          <Link href="/new-order" className="hidden items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white sm:inline-flex">Open New Order <ArrowUpRight size={14}/></Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {["Category","Provider","Service"].map((label,i)=><div key={label}><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label><div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">{i===0?"Select category":i===1?"Select provider":"Select service"}<span>⌄</span></div></div>)}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_160px]">
          {["Description","Target / Link","Quantity"].map(label=><div key={label}><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label><div className="h-11 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">{label==="Quantity"?"Min – Max":"Enter "+label.toLowerCase()}</div></div>)}
        </div>
        <Link href="/new-order" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm hover:bg-emerald-600"><Zap size={16}/> Place Order</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50"><ShieldCheck size={17} className="text-emerald-600"/></div><div><h2 className="text-sm font-bold text-slate-900">System Status</h2><p className="text-[11px] text-slate-500">{settings?.environment??"production"} environment</p></div></div>
        <div className="mt-5 space-y-2.5">
          {[["Private access",settings?.privateMode],["Owner allowlist",settings?.ownerEmailConfigured],["Provider connection",settings?.providerConfigured],["Auto sync",settings?.syncConfigured]].map(([label,ready])=><div key={String(label)} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"><span className="text-xs text-slate-600">{String(label)}</span><span className={"text-[10px] font-bold "+(ready?"text-emerald-600":"text-amber-600")}>{ready?"READY":"PENDING"}</span></div>)}
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-3"><div className="flex justify-between text-[10px] font-semibold text-slate-500"><span>Completion rate</span><span className="text-emerald-600">{completionRate}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{width:completionRate+"%"}}/></div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>Active {activeRate}%</span><span>{stats?.totalQuantity?.toLocaleString()??0} quantity processed</span></div></div>
      </div>
    </section>

    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div><div className="flex items-center gap-2 text-emerald-600"><ClipboardList size={15}/><span className="text-[10px] font-bold uppercase tracking-[.16em]">Latest activity</span></div><h2 className="mt-1 text-lg font-bold text-slate-900">Recent Orders</h2></div>
        <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-600">View all <ArrowUpRight size={14}/></Link>
      </div>
      {recentOrders.length ? <div className="divide-y divide-slate-100">{recentOrders.map(o=>{const pct=o.quantity?Math.min(100,Math.round((o.completedQuantity??0)/o.quantity*100)):0;return <Link href="/orders" key={o.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-semibold text-slate-800">{o.id.slice(0,8)}</span><span className={"rounded-full border px-2 py-0.5 text-[9px] font-bold capitalize "+(o.status==="completed"?"border-emerald-200 bg-emerald-50 text-emerald-600":o.status==="failed"?"border-rose-200 bg-rose-50 text-rose-600":"border-slate-200 bg-slate-50 text-slate-500")}>{o.status}</span></div><p className="mt-1 truncate text-xs text-slate-500">{o.target}</p></div><div className="flex items-center gap-5 text-right"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Progress</p><p className="mt-1 text-xs font-semibold text-slate-600">{pct}% · {o.quantity.toLocaleString()}</p></div><ArrowUpRight size={15} className="text-slate-300"/></div></Link>})}</div> : <div className="px-5 py-10 text-center text-sm text-slate-500">No orders yet. Create your first order to see activity here.</div>}
    </section>

    <section className="mt-4 grid gap-3 md:grid-cols-3">
      {[
        ["Manage orders","Track provider progress, statuses and completed quantities.","/orders",ClipboardList],
        ["Provider control","Test connectivity, sync services and inspect provider health.","/providers",Zap],
        ["Security & settings","Review private access and deployment configuration.","/settings",ShieldCheck]
      ].map(([title,desc,href,Icon])=><Link key={String(href)} href={String(href)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon size={18}/></div><ArrowUpRight size={16} className="text-slate-300"/></div><h3 className="mt-4 text-sm font-bold text-slate-900">{String(title)}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{String(desc)}</p></Link>)}
    </section>
   </div>
  </div>
 </main>;
}
