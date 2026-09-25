import { NextResponse } from "next/server";

function getExpectedOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (forwardedHost && forwardedProto) {
    return new URL(`${forwardedProto}://${forwardedHost}`);
  }

  return new URL(request.url);
}

function matchesExpectedOrigin(value: string, expected: URL) {
  try {
    const candidate = new URL(value);
    return candidate.protocol === expected.protocol && candidate.host === expected.host;
  } catch {
    return false;
  }
}

export function requireSameOrigin(request: Request) {
  const expectedOrigin = getExpectedOrigin(request);
  const origin = request.headers.get("origin");

  if (origin) {
    if (!matchesExpectedOrigin(origin, expectedOrigin)) {
      return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (referer && !matchesExpectedOrigin(referer, expectedOrigin)) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }

  return null;
}
