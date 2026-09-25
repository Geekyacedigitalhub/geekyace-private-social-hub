import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";

export async function GET(request: Request) {
  const limited = rateLimit(request, "settings-read", 20);
  if (!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied = await requireOwner();
  if (denied) return denied;
  return NextResponse.json({ privateMode:true, ownerEmailConfigured:Boolean(process.env.PRIVATE_OWNER_EMAIL), providerConfigured:Boolean(process.env.PROVIDER_API_BASE_URL&&process.env.PROVIDER_API_KEY), syncConfigured:Boolean(process.env.INTERNAL_SYNC_SECRET), environment:process.env.NODE_ENV }, {headers:{"Cache-Control":"no-store, max-age=0"}});
}
