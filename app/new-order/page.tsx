"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, CheckCircle2, Info } from "lucide-react";

type Service = { id: string; name: string; platform: string; min: number; max: number };

export default function NewOrderPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/services")
      .then((response) => response.json())
      .then((data: { services?: Service[] }) => setServices(data.services ?? []))
      .catch(() => setServices([]));
  }, []);

  const selected = services.find((service) => service.id === serviceId);

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, target, quantity: Number(quantity) }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; order?: { id: string } };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to create order.");
      setMessage("Order created successfully. Order ID: " + data.order?.id);
      setTarget("");
      setQuantity("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl p-5 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <header className="mt-6">
          <p className="text-sm font-medium text-emerald-600">Order workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">New order</h1>
          <p className="mt-1 text-sm text-slate-500">Submit an order through a configured provider service.</p>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]"><div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={18} />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Provider-backed ordering</p>
                <p className="mt-1 text-xs leading-5 text-emerald-900/70">
                  Provider credentials remain server-side. The panel sends only the selected service, target, and quantity.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submitOrder} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Service</span>
              <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                <option value="">Select a service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.platform} — {service.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Target</span>
              <input required value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Target URL, username, channel, or provider-supported target" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Quantity</span>
              <input required min={selected?.min ?? 1} max={selected?.max ?? undefined} type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={selected ? selected.min + " – " + selected.max : "Quantity"} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              {selected ? <span className="mt-1 block text-xs text-slate-500">Allowed: {selected.min.toLocaleString()} – {selected.max.toLocaleString()}</span> : null}
            </label>

            <button disabled={submitting || !services.length} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">
              {submitting ? "Creating order..." : "Place order"}
            </button>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Info size={17} className="text-emerald-600"/><h2 className="font-semibold text-slate-900">Order summary</h2></div>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Platform</span><span className="font-medium text-slate-800">{selected?.platform ?? "—"}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Service</span><span className="max-w-[180px] text-right font-medium text-slate-800">{selected?.name ?? "—"}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Quantity</span><span className="font-medium text-slate-800">{quantity ? Number(quantity).toLocaleString() : "—"}</span></div></div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5"><h2 className="font-semibold text-emerald-900">Before placing</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-emerald-800"><li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>Check the target carefully.</li><li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>Use a quantity within the displayed limits.</li><li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>Do not resubmit if an order is already accepted.</li></ul></div>
        </aside>
      </div>
    </main>
  );
}
