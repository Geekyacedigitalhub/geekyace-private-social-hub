import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const providers=[
  ["TaskletPay","PROVIDER_API_KEY_TASKLETPAY"],
  ["Shoprime","PROVIDER_API_KEY_SHOPRIME"],
  ["ClassySMM","PROVIDER_API_KEY_CLASSYSMM"],
  ["PawaBoost","PROVIDER_API_KEY_PAWABOOST"],
  ["Caryvn","PROVIDER_API_KEY_CARYVN"],
  ["Really Simple Social","PROVIDER_API_KEY_REALLY_SIMPLE_SOCIAL"],
] as const;

export async function GET(request:Request){
  const limited=rateLimit(request,"api-keys-read",20);
  if(!limited.allowed)return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if(denied)return denied;
  return NextResponse.json({keys:providers.map(([name,env])=>({name,configured:Boolean(process.env[env]),source:"server environment",lastFour:process.env[env]?.trim()?.slice(-4)||null}))},{headers:{"Cache-Control":"no-store, max-age=0"}});
}