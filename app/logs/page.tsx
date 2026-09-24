"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

type Event = { id:string; orderId:string; eventType:string; message:string; createdAt:string };
type Audit = { id:string; action:string; actor:string|null; createdAt:string };

export default function LogsPage() {
  const [events,setEvents]=useState<Event[]>([]);
  const [audits,setAudits]=useState<Audit[]>([]);
  useEffect(()=>{fetch("/api/logs").then(r=>r.json()).then(d=>{setEvents(d.events??[]);setAudits(d.audits??[]);});},[]);
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-6xl p-5 sm:p-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"><ArrowLeft size={16}/> Dashboard</Link>
    <h1 className="mt-5 text-2xl font-bold text-slate-900">Logs</h1><p className="mt-1 text-sm text-slate-500">Recent order events and administrative audit records.</p>
    <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Order events</h2><div className="mt-4 space-y-3">{events.length?events.map(e=><div key={e.id} className="border-b border-slate-100 pb-3"><p className="text-sm font-medium text-slate-800">{e.message}</p><p className="mt-1 text-xs text-slate-500">{e.eventType} · {new Date(e.createdAt).toLocaleString()}</p></div>):<p className="text-sm text-slate-500">No events yet.</p>}</div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Audit logs</h2><div className="mt-4 space-y-3">{audits.length?audits.map(a=><div key={a.id} className="border-b border-slate-100 pb-3"><p className="text-sm font-medium text-slate-800">{a.action}</p><p className="mt-1 text-xs text-slate-500">{a.actor??"system"} · {new Date(a.createdAt).toLocaleString()}</p></div>):<p className="text-sm text-slate-500">No audit records yet.</p>}</div></div>
    </section>
  </div></main>;
}
