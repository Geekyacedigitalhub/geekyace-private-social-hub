import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    privateMode: true,
    ownerEmailConfigured: Boolean(process.env.PRIVATE_OWNER_EMAIL),
    providerConfigured: Boolean(process.env.PROVIDER_API_BASE_URL && process.env.PROVIDER_API_KEY),
    syncConfigured: Boolean(process.env.INTERNAL_SYNC_SECRET),
    environment: process.env.NODE_ENV,
  });
}
