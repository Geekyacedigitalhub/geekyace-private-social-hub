"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, ChevronRight, Info, ShieldCheck, Sparkles, Zap } from "lucide-react";

type OrderRequirements = { requiredFields?: string[]; omitQuantity?: boolean };
type RoutingCandidate = { providerId:string; provider:string; pricePerThousand:number|null; min:number; max:number; refillSupported:boolean; health:string; latencyMs:number|null; matchScore:number };
type Service = { id:string; name:string; platform:string; min:number; max:number; serviceType?:string; orderRequirements?:OrderRequirements };
type CategoryProvider = { providerId:string; provider:string; serviceCount:number; services:Array<{id:string;name:string;min:number;max:number;pricePerThousand:number|null;refillSupported:boolean}> };
type Category = { id:string; label:string; platform:string; type:string; providers:CategoryProvider[] };

const typeLabel = (value?:string) => ({
 followers:"Followers", likes:"Likes", views:"Views", comments:"Comments", shares:"Shares", saves:"Saves",
 subscribers:"Subscribers", members:"Members", reactions:"Reactions", reposts:"Reposts", story_views:"Story Views",
 live_viewers:"Live Viewers", watch_time:"Watch Time", profile_visits:"Profile Visits", engagement:"Engagement",
 mentions:"Mentions", votes:"Votes", reviews:"Reviews", ratings:"Ratings", traffic:"Traffic", impressions:"Impressions",
 page_likes:"Page Likes", group_members:"Group Members", channel_members:"Channel Members", post_shares:"Post Shares",
 story_shares:"Story Shares", poll_votes:"Poll Votes", other:"Other"
}[value ?? "other"] ?? value ?? "Other");

const fieldLabels:Record<string,string> = { comments:"Comments (one per line)", usernames:"Usernames (one per line)", hashtags:"Hashtags (one per line)", hashtag:"Hashtag", username:"Username", media_url:"Media URL", groups:"Groups (one per line)", answer_number:"Poll answer number (1 or 2)" };
const fieldPlaceholders:Record<string,string> = { comments:"Great post!\nLove this!\nAmazing!", usernames:"@user1\n@user2", hashtags:"#tag1\n#tag2", hashtag:"#yourtag", username:"@targetuser", media_url:"https://instagram.com/p/...", groups:"Group 1\nGroup 2", answer_number:"1" };
const multilineFields = new Set(["comments","usernames","hashtags","groups"]);

export default function NewOrderPage() {
  const [services,setServices]=useState<Service[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [categoryId,setCategoryId]=useState("");
  const [providerId,setProviderId]=useState("");
  const [serviceId,setServiceId]=useState("");
  const [target,setTarget]=useState("");
  const [quantity,setQuantity]=useState("");
  const [fields,setFields]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [routing,setRouting]=useState<{selectedProviderId:string|null;candidates:RoutingCandidate[]}>({selectedProviderId:null,candidates:[]});
  const [providerMode,setProviderMode]=useState<"auto"|"manual">("auto");

  useEffect(()=>{
    fetch("/api/providers/category",{cache:"no-store"}).then(r=>r.json()).then((d:{categories?:Category[]})=>setCategories(d.categories??[])).catch(()=>setCategories([]));
    fetch("/api/services").then(r=>r.json()).then((d:{services?:Service[]})=>{
      const list=d.services??[]; setServices(list);
      const id=new URLSearchParams(window.location.search).get("serviceId");
      if(id&&list.some(x=>x.id===id))setServiceId(id);
    }).catch(()=>setServices([]));
  },[]);

  const selected=services.find(x=>x.id===serviceId);
  const selectedCategory=categories.find(x=>x.id===categoryId);
  const selectedProvider=selectedCategory?.providers.find(x=>x.providerId===providerId);
  const categoryServiceIds=new Set((selectedProvider?.services??[]).map(x=>x.id));
  const visibleServices=providerId ? services.filter(x=>categoryServiceIds.has(x.id)) : [];
  const requiredFields=selected?.orderRequirements?.requiredFields??[];
  const omitQuantity=selected?.orderRequirements?.omitQuantity===true;
  const commentCount=useMemo(()=>((fields.comments??"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length),[fields.comments]);

  function providerRateLabel(p:CategoryProvider){
    const prices=p.services.map(x=>x.pricePerThousand).filter((x):x is number=>x!=null);
    if(!prices.length)return "Rate unavailable";
    const a=Math.min(...prices),b=Math.max(...prices);
    return a===b ? `${a.toLocaleString(undefined,{maximumFractionDigits:4})} / 1K` : `${a.toLocaleString(undefined,{maximumFractionDigits:4})}–${b.toLocaleString(undefined,{maximumFractionDigits:4})} / 1K`;
  }

  useEffect(()=>{
    if(!serviceId){setRouting({selectedProviderId:null,candidates:[]});setProviderMode("auto");return;}
    fetch("/api/providers/routing?serviceId="+encodeURIComponent(serviceId),{cache:"no-store"}).then(r=>r.json()).then((d:{selectedProviderId?:string|null;candidates?:RoutingCandidate[]})=>{
      setRouting({selectedProviderId:d.selectedProviderId??null,candidates:d.candidates??[]}); setProviderMode("auto");
    }).catch(()=>setRouting({selectedProviderId:null,candidates:[]}));
  },[serviceId]);

  function changeCategory(id:string){setCategoryId(id);setProviderId("");setServiceId("");setProviderMode("auto");setFields({});setQuantity("");setMessage("");}
  function changeProvider(id:string){
    setProviderId(id);setProviderMode(id?"manual":"auto");setServiceId("");setFields({});setQuantity("");setMessage("");
  }
  function changeService(id:string){setServiceId(id);setFields({});setMessage("");const next=services.find(x=>x.id===id);if(next?.orderRequirements?.omitQuantity)setQuantity("");}
  function updateField(key:string,value:string){
    setFields(c=>({...c,[key]:value}));
    if(key==="comments"&&omitQuantity){const count=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length;setQuantity(count?String(count):"");}
  }

  async function submitOrder(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setSubmitting(true);setMessage("");
    const idempotencyKey=crypto.randomUUID();
    const selectedProviderId=providerMode==="manual" ? (routing.selectedProviderId||undefined) : undefined;
    try{
      const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey},body:JSON.stringify({serviceId,target,quantity:Number(quantity),fields,...(selectedProviderId?{providerId:selectedProviderId}:{})})});
      const d=await r.json() as {ok?:boolean;pending?:boolean;error?:string;order?:{id:string}};
      if(!r.ok||!d.ok)throw new Error(d.error??"Unable to create order.");
      setMessage(d.pending?"Order is already being processed. Order ID: "+d.order?.id:"Order created successfully. Order ID: "+d.order?.id);
      if(!d.pending){setTarget("");setQuantity("");setFields({});}
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to create order");}finally{setSubmitting(false);}
  }

  return <main className="gx-page min-h-screen">
    <div className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-2 text-xs text-slate-500"><Link href="/" className="hover:text-emerald-600">Dashboard</Link><ChevronRight size={13}/><span className="font-medium text-slate-700">New Order</span></div>

      <div className="mt-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-600"><Sparkles size={13}/> Order workspace</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Create a new order</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Choose your category, provider and service, then enter the target and order details.</p>
        </div>
        <Link href="/orders" className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm hover:border-emerald-200 hover:text-emerald-700"><ArrowLeft size={14}/> View orders</Link>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <section className="gx-card rounded-2xl overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Zap size={16}/></span><div><h2 className="text-sm font-bold text-slate-900">Order details</h2><p className="text-[11px] text-slate-500">Select the catalog service you want to use.</p></div></div>
          </div>
          <form onSubmit={submitOrder} className="p-6 lg:p-7">
            <div className="grid gap-5 md:grid-cols-2">
              <label><span className="text-xs font-bold text-slate-700">Category</span><select required value={categoryId} onChange={e=>changeCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"><option value="">Select a category</option>{categories.map(x=><option key={x.id} value={x.id}>{x.label.replace(/\b\w/g,m=>m.toUpperCase())}</option>)}</select></label>
              <label><span className="text-xs font-bold text-slate-700">Provider</span><select required value={providerId} onChange={e=>changeProvider(e.target.value)} disabled={!selectedCategory} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 disabled:bg-slate-50 disabled:text-slate-400"><option value="">Select a provider</option>{selectedCategory?.providers.map(x=><option key={x.providerId} value={x.providerId}>{x.provider} · {x.serviceCount} services · {providerRateLabel(x)}</option>)}</select></label>
            </div>

            {selectedProvider&&<div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:grid-cols-4">
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Services</span><b className="mt-1 block text-sm text-slate-900">{selectedProvider.serviceCount}</b></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Refill</span><b className="mt-1 block text-sm text-slate-900">{selectedProvider.services.filter(x=>x.refillSupported).length}/{selectedProvider.serviceCount}</b></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rate / 1K</span><b className="mt-1 block text-sm text-emerald-700">{providerRateLabel(selectedProvider)}</b></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Catalog</span><b className="mt-1 flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={14}/> Available</b></div>
            </div>}

            <label className="mt-5 block"><span className="text-xs font-bold text-slate-700">Service</span><select required value={serviceId} onChange={e=>changeService(e.target.value)} disabled={!providerId} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 disabled:bg-slate-50">{<option value="">Select a service</option>}{visibleServices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{selected&&<span className="mt-2 block text-[11px] font-medium text-emerald-700">{selected.platform} · {typeLabel(selected.serviceType)} · {selected.min.toLocaleString()}–{selected.max.toLocaleString()}</span>}</label>

            <label className="mt-5 block"><span className="text-xs font-bold text-slate-700">Target</span><input required value={target} onChange={e=>setTarget(e.target.value)} placeholder="URL, username, channel or supported target" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"/></label>

            {requiredFields.map(key=><label key={key} className="mt-5 block"><span className="text-xs font-bold text-slate-700">{fieldLabels[key]??key}</span>{multilineFields.has(key)?<textarea required value={fields[key]??""} onChange={e=>updateField(key,e.target.value)} rows={key==="comments"?6:4} placeholder={fieldPlaceholders[key]} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"/>:<input required value={fields[key]??""} onChange={e=>updateField(key,e.target.value)} type={key==="answer_number"?"number":"text"} min={key==="answer_number"?1:undefined} max={key==="answer_number"?2:undefined} placeholder={fieldPlaceholders[key]} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"/>}{key==="comments"&&<span className="mt-1.5 block text-[11px] text-slate-400">{commentCount} non-empty comments · must match quantity</span>}</label>)}

            <label className="mt-5 block"><span className="text-xs font-bold text-slate-700">{omitQuantity?"Quantity / derived count":"Quantity"}</span><input required min={selected?.min??1} max={selected?.max} type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} readOnly={omitQuantity} placeholder={selected?selected.min+" – "+selected.max:"Quantity"} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 read-only:bg-slate-50"/>{selected&&<span className="mt-1.5 block text-[11px] text-slate-400">Allowed range: {selected.min.toLocaleString()} – {selected.max.toLocaleString()}</span>}</label>

            <button type="submit" disabled={submitting||!services.length} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"><Zap size={16}/>{submitting?"Creating order...":"Place order"}</button>
            {message&&<p className={"mt-3 rounded-xl border px-4 py-3 text-xs font-medium "+(message.startsWith("Order created")||message.startsWith("Order is already")?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-rose-200 bg-rose-50 text-rose-700")}>{message}</p>}
          </form>
        </section>

        <aside className="space-y-5">
          <div className="gx-card rounded-2xl overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><Info size={16} className="text-emerald-600"/><h2 className="text-sm font-bold text-slate-900">Order summary</h2></div></div>
            <div className="space-y-4 p-5 text-xs">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Platform</span><b className="text-slate-800">{selected?.platform??"—"}</b></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Service type</span><b className="text-slate-800">{selected?typeLabel(selected.serviceType):"—"}</b></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Quantity</span><b className="text-slate-800">{quantity?Number(quantity).toLocaleString():"—"}</b></div>
              <div className="border-t border-slate-100 pt-4"><span className="text-slate-500">Selected provider</span><p className="mt-1 text-sm font-bold text-emerald-700">{routing.candidates.find(x=>x.providerId===routing.selectedProviderId)?.provider??(providerId?selectedProvider?.provider:"Smart Auto")??"—"}</p></div>
            </div>
          </div>

          {routing.candidates.length>0&&<div className="gx-card rounded-2xl overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Provider routing</h2><p className="mt-1 text-[11px] text-slate-500">Compatible providers for this service.</p></div><Activity size={16} className="text-emerald-600"/></div></div>
            <div className="p-4">
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={()=>{setProviderMode("auto");setRouting(c=>({...c,selectedProviderId:c.candidates[0]?.providerId??null}))}} className={"flex-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider "+(providerMode==="auto"?"bg-white text-emerald-700 shadow-sm":"text-slate-500")}>Smart Auto</button><span className="flex items-center px-2 text-[10px] text-slate-400">or manual</span></div>
              <div className="mt-3 space-y-2">{routing.candidates.map(c=>{const active=c.providerId===routing.selectedProviderId;const health=c.health==="healthy"?"Healthy":c.health==="degraded"?"Degraded":c.health==="down"?"Down":"Unknown";return <button type="button" key={c.providerId} onClick={()=>{setProviderMode("manual");setRouting(x=>({...x,selectedProviderId:c.providerId}));}} className={"w-full rounded-xl border p-3 text-left "+(active&&providerMode==="manual"?"border-emerald-300 bg-emerald-50":"border-slate-200 bg-white hover:border-emerald-200")}>
                <div className="flex items-center justify-between"><b className="text-xs text-slate-900">{c.provider}</b>{active&&providerMode==="manual"&&<span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">Selected</span>}</div>
                <p className="mt-1 text-[10px] text-slate-400">{health}{c.latencyMs!=null?" · "+c.latencyMs+"ms":""} · Match {c.matchScore}%</p>
                <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-2"><span className="block text-[9px] uppercase text-slate-400">Rate / 1K</span><b className="mt-1 block text-xs text-emerald-700">{c.pricePerThousand==null?"—":c.pricePerThousand.toLocaleString(undefined,{maximumFractionDigits:2})}</b></div><div className="rounded-lg bg-slate-50 p-2"><span className="block text-[9px] uppercase text-slate-400">This order</span><b className="mt-1 block text-xs text-slate-800">{c.pricePerThousand==null||!quantity?"—":(c.pricePerThousand*Number(quantity)/1000).toLocaleString(undefined,{maximumFractionDigits:2})}</b></div></div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{c.min.toLocaleString()} – {c.max.toLocaleString()}</span><span className={c.refillSupported?"font-semibold text-emerald-600":"text-slate-400"}>{c.refillSupported?"✓ Refill":"No refill"}</span></div>
              </button>})}</div>
            </div>
          </div>}

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-600"/><div><h3 className="text-xs font-bold text-slate-900">Private & protected</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Provider credentials stay server-side. Only the order data required for the selected service is submitted.</p></div></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-xs font-bold text-slate-900">Before placing</h3><ul className="mt-3 space-y-2 text-[11px] text-slate-500"><li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600"/>Check the target carefully.</li><li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600"/>Stay within the displayed range.</li><li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600"/>Do not resubmit an accepted order.</li></ul></div>
        </aside>
      </div>
    </div>
  </main>;
}
