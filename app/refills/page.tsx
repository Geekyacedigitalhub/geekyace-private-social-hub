"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

type Refill = {
  id: string;
  orderId: string;
  providerRefillId: string | null;
  status: string;
  createdAt: string;
};

export default function RefillsPage() {
  const [refills, setRefills] = useState<Refill[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/refills", { cache: "no-store" });
    const data = await response.json();
    setRefills(data.refills ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Refills</h1>
            <p className="mt-1 text-sm text-slate-500">Track provider-supported refill records and retention checks.</p>
          </div>
          <button onClick={() => { setLoading(true); void load(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? <div className="p-8 text-sm text-slate-500">Loading refills...</div> :
          !refills.length ? <div className="p-10 text-center"><p className="font-semibold text-slate-900">No refill records</p><p className="mt-1 text-sm text-slate-500">Refill records will appear when a supported provider operation creates them.</p></div> :
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Refill</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Provider refill</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-100">{refills.map((item) => <tr key={item.id}><td className="px-4 py-4 font-medium">{item.id.slice(0, 8)}</td><td className="px-4 py-4">{item.orderId.slice(0, 8)}</td><td className="px-4 py-4">{item.providerRefillId ?? "—"}</td><td className="px-4 py-4 capitalize">{item.status}</td><td className="px-4 py-4 text-slate-500">{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
