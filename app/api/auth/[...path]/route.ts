import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";

const OWNER_EMAIL = () => process.env.PRIVATE_OWNER_EMAIL?.trim().toLowerCase() ?? "";

async function enforcePrivateAuth(request: Request) {
  const pathname = new URL(request.url).pathname;
  const ownerEmail = OWNER_EMAIL();

  if (!ownerEmail) {
    return NextResponse.json({ error: "Private owner access is not configured." }, { status: 503 });
  }

  if (pathname.endsWith("/sign-up/email")) {
    try {
      const body = (await request.clone().json()) as { email?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email !== ownerEmail) {
        return NextResponse.json(
          { error: "Public registration is disabled for this private panel." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid authentication request." }, { status: 400 });
    }
  }

  if (pathname.endsWith("/sign-in/social") || pathname.includes("/sign-up/social")) {
    return NextResponse.json(
      { error: "Social sign-in is disabled for this private panel." },
      { status: 403 },
    );
  }

  return null;
}

const authHandler = auth.handler();\n\ntype AuthRouteContext = Parameters<typeof authHandler.POST>[1];\n\nasync function POST(request: Request, context: AuthRouteContext) {
  const blocked = await enforcePrivateAuth(request);
  if (blocked) return blocked;
  return authHandler.POST(request, context);
}

export const GET = authHandler.GET;
export { POST };
