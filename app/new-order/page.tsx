"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Info, ShieldCheck, Sparkles, Zap, Activity } from "lucide-react";

type OrderRequirements = {
  requiredFields?: string[];
  omitQuantity?: boolean;
};

type RoutingCandidate = { providerId:string; provider:string; pricePerThousand:number|null; min:number; max:number; refillSupported:boolean; health:string; latencyMs:number|null; matchScore:number; };
type Service = {
  id: string;
  name: string;
  platform: string;
  min: number;
  max: number;
  serviceType?: string;
  orderRequirements?: OrderRequirements;
};

const typeLabel = (value?: string) => ({
  followers: "Followers",
  likes: "Likes",
  views: "Views",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  subscribers: "Subscribers",
  members: "Members",
  reactions: "Reactions",
  reposts: "Reposts",
  story_views: "Story Views",
  live_viewers: "Live Viewers",
  watch_time: "Watch Time",
  profile_visits: "Profile Visits",
  engagement: "Engagement",
  mentions: "Mentions",
  votes: "Votes",
  reviews: "Reviews",
  ratings: "Ratings",
  traffic: "Traffic",
  app_downloads: "App Downloads",
  downloads: "Downloads",
  signups: "Signups",
  direct_messages: "Direct Messages",
  bot_chat: "Bot Chat",
  connections: "Connections",
  sound_use: "Sound Use",
  app_download_signup: "App Download + Signup",
  signup_like: "Signup + Like",
  page_likes: "Page Likes",
  group_members: "Group Members",
  channel_members: "Channel Members",
  post_shares: "Post Shares",
  story_shares: "Story Shares",
  custom_meme_comments: "Custom Meme Comments",
  meme_comments: "Meme Comments",
  poll_votes: "Poll Votes",
  channel_follows: "Channel Follows",
  repins: "Repins",
  impressions: "Impressions",
  other: "Other",
}[value ?? "other"] ?? value ?? "Other");

const fieldLabels: Record<string, string> = {
  comments: "Comments (one per line)",
  usernames: "Usernames (one per line)",
  hashtags: "Hashtags (one per line)",
  hashtag: "Hashtag",
  username: "Username",
  media_url: "Media URL",
  groups: "Groups (one per line)",
  answer_number: "Poll answer number (1 or 2)",
};

const fieldPlaceholders: Record<string, string> = {
  comments: "Great post!\nLove this!\nAmazing!",
  usernames: "@user1\n@user2",
  hashtags: "#tag1\n#tag2",
  hashtag: "#yourtag",
  username: "@targetuser",
  media_url: "https://instagram.com/p/...",
  groups: "Group 1\nGroup 2",
  answer_number: "1",
};

const multilineFields = new Set(["comments", "usernames", "hashtags", "groups"]);

export default function NewOrderPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [routing, setRouting] = useState<{selectedProviderId:string|null;candidates:RoutingCandidate[]}>({selectedProviderId:null,candidates:[]});
  const [providerMode, setProviderMode] = useState<"auto" | "manual">("auto");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d: { services?: Service[] }) => {
        const list = d.services ?? [];
        setServices(list);
        const id = new URLSearchParams(window.location.search).get("serviceId");
        if (id && list.some((x) => x.id === id)) setServiceId(id);
      })
      .catch(() => setServices([]));
  }, []);

  const selected = services.find((x) => x.id === serviceId);

  useEffect(() => {
    if (!serviceId) {
      setRouting({ selectedProviderId: null, candidates: [] });
      setProviderMode("auto");
      return;
    }
    fetch("/api/providers/routing?serviceId=" + encodeURIComponent(serviceId), { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { selectedProviderId?: string | null; candidates?: RoutingCandidate[] }) => {
        setRouting({
          selectedProviderId: d.selectedProviderId ?? null,
          candidates: d.candidates ?? [],
        });
        setProviderMode("auto");
      })
      .catch(() => setRouting({ selectedProviderId: null, candidates: [] }));
  }, [serviceId]);
  const requiredFields = selected?.orderRequirements?.requiredFields ?? [];
  const omitQuantity = selected?.orderRequirements?.omitQuantity === true;

  const commentCount = useMemo(() => {
    const value = fields.comments ?? "";
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
  }, [fields.comments]);

  function changeService(id: string) {
    setServiceId(id);
    setFields({});
    setMessage("");
    const next = services.find((x) => x.id === id);
    if (next?.orderRequirements?.omitQuantity) setQuantity("");
  }

  function updateField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    if (key === "comments" && omitQuantity) {
      const count = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
      setQuantity(count ? String(count) : "");
    }
  }

  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const idempotencyKey = crypto.randomUUID();
    const selectedProviderId = providerMode === "manual" ? routing.selectedProviderId : undefined;

    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          serviceId,
          target,
          quantity: Number(quantity),
          fields,
          ...(selectedProviderId ? { providerId: selectedProviderId } : {}),
        }),
      });
      const d = await r.json() as { ok?: boolean; pending?: boolean; error?: string; order?: { id: string } };
      if (!r.ok || !d.ok) throw new Error(d.error ?? "Unable to create order.");

      if (d.pending) {
        setMessage("Order is already being processed. Order ID: " + d.order?.id);
      } else {
        setMessage("Order created successfully. Order ID: " + d.order?.id);
        setTarget("");
        setQuantity("");
        setFields({});
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06100c]">
      <div className="mx-auto max-w-6xl p-5 sm:p-8 xl:p-10">
        <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-emerald-300">← Command center</Link>
        <header className="mt-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-400"><Sparkles size={13} /> Order workspace</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Create a new order</h1>
          <p className="mt-2 text-sm text-slate-500">Select a mapped provider service, define the target and submit the fields required by that provider service.</p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="gx-card rounded-3xl p-6 sm:p-8">
            <div className="flex gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.045] p-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-300" size={18} />
              <div>
                <p className="text-sm font-semibold text-white">Private provider routing</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Credentials remain server-side. Only the selected service, target, quantity and required order fields are submitted.</p>
              </div>
            </div>

            <form onSubmit={submitOrder} className="mt-7 space-y-6">
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">Service</span>
                <select required value={serviceId} onChange={(e) => changeService(e.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0b1913] px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-400/50">
                  <option value="">Select a service</option>
                  {services.map((x) => <option key={x.id} value={x.id}>{x.platform} — {x.name}</option>)}
                </select>
                {selected ? <span className="mt-2 block text-[11px] text-emerald-300/80">{selected.platform} · {typeLabel(selected.serviceType)}</span> : null}
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-400">Target</span>
                <input required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="URL, username, channel or supported target" className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0b1913] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-emerald-400/50" />
              </label>

              {requiredFields.map((key) => {
                const multiline = multilineFields.has(key);
                return (
                  <label key={key} className="block">
                    <span className="text-xs font-semibold text-slate-400">{fieldLabels[key] ?? key}</span>
                    {multiline ? (
                      <textarea required value={fields[key] ?? ""} onChange={(e) => updateField(key, e.target.value)} rows={key === "comments" ? 6 : 4} placeholder={fieldPlaceholders[key]} className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-[#0b1913] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-emerald-400/50" />
                    ) : (
                      <input required value={fields[key] ?? ""} onChange={(e) => updateField(key, e.target.value)} type={key === "answer_number" ? "number" : "text"} min={key === "answer_number" ? 1 : undefined} max={key === "answer_number" ? 2 : undefined} placeholder={fieldPlaceholders[key]} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0b1913] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-emerald-400/50" />
                    )}
                    {key === "comments" ? <span className="mt-2 block text-[11px] text-slate-600">{commentCount} non-empty comment{commentCount === 1 ? "" : "s"} · must match quantity</span> : null}
                  </label>
                );
              })}

              <label className="block">
                <span className="text-xs font-semibold text-slate-400">{omitQuantity ? "Quantity / derived count" : "Quantity"}</span>
                <input required min={selected?.min ?? 1} max={selected?.max} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={selected ? selected.min + " – " + selected.max : "Quantity"} readOnly={omitQuantity} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0b1913] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-emerald-400/50 read-only:opacity-70" />
                {selected ? <span className="mt-2 block text-[11px] text-slate-600">Allowed range: {selected.min.toLocaleString()} – {selected.max.toLocaleString()}</span> : null}
              </label>

              <button type="submit" disabled={submitting || !services.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#06100c] shadow-[0_12px_35px_rgba(52,211,153,.1)] disabled:opacity-40">
                <Zap size={15} />{submitting ? "Creating order..." : "Place order"}
              </button>

              {message ? <p className={"rounded-xl border px-3 py-2.5 text-xs " + (message.startsWith("Order created") || message.startsWith("Order is already") ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300" : "border-rose-400/15 bg-rose-400/[0.06] text-rose-300")}>{message}</p> : null}
            </form>
          </section>

          <aside className="space-y-4">
            <div className="gx-card rounded-3xl p-6">
              <div className="flex items-center gap-2"><Info size={16} className="text-emerald-300" /><h2 className="font-semibold text-white">Order summary</h2></div>
              <div className="mt-6 space-y-4 text-xs">
                <div className="flex justify-between gap-3"><span className="text-slate-600">Platform</span><span className="font-semibold text-slate-300">{selected?.platform ?? "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-600">Service type</span><span className="font-semibold text-slate-300">{selected ? typeLabel(selected.serviceType) : "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-600">Service</span><span className="max-w-[190px] text-right font-semibold text-slate-300">{selected?.name ?? "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-600">Quantity</span><span className="font-semibold text-slate-300">{quantity ? Number(quantity).toLocaleString() : "—"}</span></div>
                <div className="border-t border-white/[0.06] pt-4">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2"><Activity size={14} className="text-emerald-300"/><span className="text-slate-600">Provider routing</span></div>
    {routing.candidates.length ? <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{routing.candidates.length} available</span> : null}
  </div>
  <p className="mt-2 text-sm font-semibold text-emerald-300">{routing.selectedProviderId ? (routing.candidates.find(x=>x.providerId===routing.selectedProviderId)?.provider ?? "Smart Auto") : "No provider mapped yet"}</p>
  <p className="mt-1 text-[11px] text-slate-600">{routing.candidates.length ? (providerMode === "manual" ? "Manual selection is active. The order will use the selected compatible provider." : "Smart Auto compares service match, health, price and latency.") : "No compatible provider is currently mapped."}</p>
</div>
              </div>
            </div>
            {routing.candidates.length ? (
              <div className="gx-card rounded-3xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">Available providers</h2>
                    <p className="mt-1 text-[11px] text-slate-600">Smart Auto uses these compatible options for this service.</p>
                  </div>
                  <Activity size={16} className="text-emerald-300" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                  <button type="button" onClick={() => { setProviderMode("auto"); setRouting((current) => ({ ...current, selectedProviderId: current.candidates[0]?.providerId ?? null })); }} className={"flex-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider " + (providerMode === "auto" ? "bg-emerald-400 text-[#06100c]" : "text-slate-500 hover:text-white")}>Smart Auto</button>
                  <span className="text-[10px] text-slate-700">or choose manually</span>
                </div>
                <div className="mt-2 space-y-2">
                  {routing.candidates.map((candidate) => {
                    const selectedProvider = candidate.providerId === routing.selectedProviderId;
                    const healthLabel = candidate.health === "healthy" ? "Healthy" : candidate.health === "degraded" ? "Degraded" : candidate.health === "down" ? "Down" : "Unknown";
                    return (
                      <button type="button" key={candidate.providerId} onClick={() => { setProviderMode("manual"); setRouting((current) => ({ ...current, selectedProviderId: candidate.providerId })); }} className={"w-full rounded-2xl border p-3 text-left transition " + (selectedProvider && providerMode === "manual" ? "border-emerald-400/30 bg-emerald-400/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:border-emerald-400/15")}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{candidate.provider}</p>
                            <p className="mt-1 text-[10px] text-slate-600">{healthLabel}{candidate.latencyMs != null ? " · " + candidate.latencyMs + "ms" : ""} · Match {candidate.matchScore}%</p>
                          </div>
                          {selectedProvider && providerMode === "manual" ? <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Selected</span> : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className="text-slate-600">Price / 1K</span>
                          <span className="font-semibold text-slate-300">{candidate.pricePerThousand == null ? "—" : Number(candidate.pricePerThousand).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          <span className="text-slate-600">Range</span>
                          <span className="text-slate-500">{candidate.min.toLocaleString()} – {candidate.max.toLocaleString()}{candidate.refillSupported ? " · Refill" : ""}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">
              <h2 className="font-semibold text-white">Before placing</h2>
              <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-500">
                <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />Check the target carefully.</li>
                <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />Stay within the displayed quantity range.</li>
                <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />Do not resubmit an accepted order.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
