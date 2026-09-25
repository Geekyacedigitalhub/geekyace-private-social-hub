import { NextResponse } from "next/server";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";

export async function POST(request: Request) {
  const limited=rateLimit(request,"provider-test",10);
  if(!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if(denied) return denied;
  const baseUrl=process.env.PROVIDER_API_BASE_URL?.trim();
  const apiKey=process.env.PROVIDER_API_KEY;
  if(!baseUrl||!apiKey) return NextResponse.json({ok:false,error:"Provider API is not configured on the server."},{status:503});
  try{
    const provider=createProviderAdapter({name:"Configured provider",baseUrl,apiKey});
    const [balance,services]=await Promise.all([provider.getBalance(),provider.getServices()]);
    return NextResponse.json({ok:true,balance:balance.balance,currency:balance.currency,serviceCount:services.length},{headers:{"Cache-Control":"no-store, max-age=0"}});
  }catch(error){console.error("Provider connection test failed:",error);return NextResponse.json({ok:false,error:"Provider connection failed."},{status:502});}
}
