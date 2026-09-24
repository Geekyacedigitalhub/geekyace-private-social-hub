"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Plus } from "lucide-react";

type Order = {
  id: string;
  target: string;
  quantity: number;
  status: string;
  startCount: number | null;
  currentCount: number | null;
  completedQuantity: number | null;
  remains: number | null;
  providerOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load orders.");
      setOrders(data.orders ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrder(id: string) {
    setRefreshing(id);
    try {
      const response = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to refresh order.");
      setOrders((current) => current.map((order) => order.id === id ? data.order : order));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh order.");
    } finally {
      setRefreshing(null);
    }
  }

  useEffect(() => { void loadOrders(); }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700">
              <ArrowLeft size={16} /> Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Orders</h1>
            <p className="mt-1 text-sm text-slate-500">Track provider-backed orders and refresh their current status.</p>
          </div>
          <Link href="/new-order" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} /> New order
          </Link>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? <div className="p-8 text-sm text-slate-500">Loading orders...</div> :
           error && !orders.length ? <div className="p-8 text-sm text-red-600">{error}</div> :
           !orders.length ? <div className="p-10 text-center"><p className="font-semibold text-slate-900">No orders yet</p><p className="mt-1 text-sm text-slate-500">Create your first provider-backed order when a service mapping is configured.</p></div> :
           <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-4 py-4"><div className="font-medium text-slate-900">{order.id.slice(0, 8)}</div><div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</div></td>
                    <td className="max-w-xs truncate px-4 py-4 text-slate-600">{order.target}</td>
                    <td className="px-4 py-4 text-slate-700">{order.quantity.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-600">{order.completedQuantity?.toLocaleString() ?? "—"} completed · {order.remains?.toLocaleString() ?? "—"} remaining</td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{order.status}</span></td>
                    <td className="px-4 py-4"><button onClick={() => void refreshOrder(order.id)} disabled={refreshing === order.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={refreshing === order.id ? "animate-spin" : ""}/> Refresh</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>}
        </section>
        {error && orders.length ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  );
}
