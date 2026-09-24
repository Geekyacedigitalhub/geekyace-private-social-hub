"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, Server, ShieldCheck } from "lucide-react";

type Settings = { privateMode:boolean; ownerEmailConfigured:boolean; providerConfigured:boolean; syncConfigured:boolean; environment:string };

export default function SettingsPage() {
  const [settings,setSettings]=useState<Settings|null>(null);
  useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(setSettings).catch(()=>setSettings(null));},[]);
  const items = settings ? [
    ["Private access", settings.privateMode, LockKeyhole],
    ["Owner allowlist", settings.ownerEmailConfigured, ShieldCheck],
    ["Provider credentials", settings.providerConfigured, Server],
    ["Automatic sync secret", settings.syncConfigured, ShieldCheck],
  ] as const : [];
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-5xl p-5 sm:p-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"><ArrowLeft size={16}/> Dashboard</Link>
    <h1 className="mt-5 text-2xl font-bold text-slate-900">Settings</h1>
    <p className="mt-1 text-sm text-slate-500">Private deployment configuration and security status. Secrets are never displayed.</p>
    <section className="mt-6 grid gap-4 sm:grid-cols-2">{items.map(([label,ready,Icon])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><Icon size={18} className="text-emerald-600"/><p className="font-semibold text-slate-900">{label}</p></div><p className={"mt-3 text-sm font-medium "+(ready?"text-emerald-700":"text-amber-700")}>{ready?"Configured":"Needs configuration"}</p></div>)}</section>
    {settings ? <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Environment: <span className="font-medium text-slate-900">{settings.environment}</span></div> : null}
  </div></main>;
}
