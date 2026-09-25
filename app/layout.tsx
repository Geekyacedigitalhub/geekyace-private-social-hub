import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { LayoutDashboard, ShoppingCart, Package, Boxes, ServerCog, RefreshCw, BarChart3, ScrollText, Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "GeekyAce Private Social Hub",
  description: "Private social-service order control panel.",
};

const nav = [
  ["Dashboard", "/", LayoutDashboard], ["New Order", "/new-order", ShoppingCart], ["Orders", "/orders", Package],
  ["Services", "/services", Boxes], ["Providers", "/providers", ServerCog], ["Refills", "/refills", RefreshCw],
  ["Analytics", "/analytics", BarChart3], ["Logs", "/logs", ScrollText], ["Settings", "/settings", Settings],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="min-h-screen bg-slate-50 md:flex">
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <Link href="/" className="border-b border-slate-100 px-3 pb-5"><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">GeekyAce</p><p className="mt-1 text-lg font-bold text-slate-900">Social Hub</p><p className="mt-1 text-xs text-slate-400">Private control panel</p></Link>
        <nav className="mt-5 space-y-1">{nav.map(([label, href, Icon]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"><Icon size={17}/>{label}</Link>)}</nav>
        <div className="mt-auto rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">PRIVATE MODE</p><p className="mt-1 text-xs leading-5 text-emerald-700">Owner-only access. Provider credentials stay server-side.</p></div>
      </div>
    </aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden"><div className="flex items-center justify-between"><Link href="/" className="font-bold text-slate-900">GeekyAce <span className="text-emerald-600">Social Hub</span></Link><Link href="/new-order" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">New Order</Link></div><nav className="mt-3 flex gap-2 overflow-x-auto pb-1">{nav.slice(0,6).map(([label, href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{label}</Link>)}</nav></header>{children}</div>
  </div></body></html>;
}
