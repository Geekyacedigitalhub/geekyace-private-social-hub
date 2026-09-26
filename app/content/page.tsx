"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, Film, Flame, Play, Sparkles, TrendingUp } from "lucide-react";
import { buildContentPlan, getStarterTrendCandidates } from "@/lib/content/engine";

const candidates = getStarterTrendCandidates();

export default function ContentPage() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function runEngine() {
    setRunning(true);
    setMessage("");
    try {
      const response = await fetch("/api/content/run", { method: "POST" });
      const data = await response.json();
      setMessage(data.message ?? "Content run completed.");
    } catch {
      setMessage("The content engine could not start. Check the server configuration.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06100c]">
      <div className="mx-auto max-w-[1480px] p-5 sm:p-8 xl:p-10">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400"><Sparkles size={13} /> Autonomous marketing</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-white sm:text-5xl">GeekyAce Content Engine</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">Discover relevant opportunities, turn them into branded short-form content, schedule the strongest ideas, publish through approved platform APIs, and learn from performance.</p>
          </div>
          <button onClick={() => void runEngine()} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#06100c] shadow-[0_10px_35px_rgba(52,211,153,.15)] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60">
            <Play size={15} /> {running ? "Running engine…" : "Run content engine"}
          </button>
        </header>

        {message ? <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-5 py-4 text-sm text-emerald-200">{message}</div> : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Trend discovery", "Continuous", Flame],
            ["Content creation", "AI pipeline", Film],
            ["Scheduling", "Automated", CalendarDays],
            ["Learning", "Performance loop", TrendingUp],
          ].map(([title, value, Icon]) => (
            <div key={String(title)} className="gx-card rounded-2xl p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/[0.07] text-emerald-300"><Icon size={18} /></div>
              <p className="mt-5 text-xs text-slate-500">{String(title)}</p>
              <p className="mt-1 text-lg font-semibold text-white">{String(value)}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="gx-card overflow-hidden rounded-3xl">
            <div className="border-b border-white/[0.06] px-6 py-5">
              <div className="flex items-center gap-2 text-emerald-400"><TrendingUp size={16} /><span className="text-xs font-bold uppercase tracking-[.16em]">Opportunity queue</span></div>
              <h2 className="mt-1.5 text-lg font-semibold text-white">Relevant trend candidates</h2>
              <p className="mt-1 text-xs text-slate-500">The production trend adapter will replace these starter candidates.</p>
            </div>
            <div className="divide-y divide-white/[0.045]">
              {candidates.map((candidate) => {
                const plan = buildContentPlan(candidate);
                return (
                  <article key={candidate.title} className="px-6 py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">{candidate.title}</h3>
                          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{plan.score} score</span>
                        </div>
                        <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{candidate.summary}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500"><Clock3 size={13} /> {candidate.source}</span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-400">Generated angle</p>
                      <p className="mt-2 text-sm font-semibold text-white">{plan.hook}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{plan.script}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="gx-card rounded-3xl p-6">
              <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={16} /><span className="text-xs font-bold uppercase tracking-[.16em]">Automation policy</span></div>
              <h2 className="mt-2 text-lg font-semibold text-white">Autonomous by design</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">The engine is designed to move from discovery to creation to publishing without requiring you to manually prepare every post.</p>
              <div className="mt-5 space-y-2 text-xs text-slate-400">
                {["Relevance filter","Brand guardrails","Platform-specific formatting","Publishing retries","Performance feedback"].map((item) => <div key={item} className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" />{item}</div>)}
              </div>
            </div>
            <Link href="/platforms" className="gx-card gx-card-hover block rounded-3xl p-6">
              <div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.045]"><CalendarDays size={18} className="text-emerald-300" /></div><span className="text-xs font-semibold text-slate-500">Connect accounts →</span></div>
              <h2 className="mt-5 text-sm font-semibold text-white">Publishing accounts</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">Social account connections will live here as the official publishing adapters are enabled.</p>
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
