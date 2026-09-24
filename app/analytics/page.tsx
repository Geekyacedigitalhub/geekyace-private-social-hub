"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";

type Stats = { totalOrders:number; activeOrders:number; completedOrders:number; failedOrders:number; refillRecords:number; events:number; totalQuantity:number };

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetch("/api/analytics").then(r => r.json()).then(setStats).catch(() => setStats(null)); }, []);
  const cards = stats ? [
    ["Total orders", stats.totalOrders], ["Active orders", stats.activeOrders], ["Completed", stats.completedOrders],
    ["Failed", stats.failedOrders], ["Refill records", stats.refillRecords], ["Order events", stats.events], ["Total quantity", stats.totalQuantity.toLocaleString()]
  ] : [];
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-6xl p-5 sm:p-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"><ArrowLeft size={16}/> Dashboard</Link>
    <div className="mt-5 flex items-center gap-3"><BarChart3 className="text-emerald-600"/><div><h1 className="text-2xl font-bold text-slate-900">Analytics</h1><p className="text-sm text-slate-500">Live operational metrics from the private panel database.</p></div></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</div>
  </div></main>;
}
