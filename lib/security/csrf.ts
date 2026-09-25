import { NextResponse } from "next/server";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedHost = new URL(request.url).host;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.protocol !== "https:" || originUrl.host !== expectedHost) {
        return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.protocol !== "https:" || refererUrl.host !== expectedHost) {
        return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request referer." }, { status: 403 });
    }
  }

  return null;
}
