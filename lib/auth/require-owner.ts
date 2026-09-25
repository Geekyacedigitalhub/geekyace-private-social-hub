import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export async function requireOwner() {
  const ownerEmail = process.env.PRIVATE_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "Private owner access is not configured." },
      { status: 503 },
    );
  }

  const result = await auth.getSession();
  if (result.error || !result.data?.session || !result.data.user) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  if (result.data.user.email.trim().toLowerCase() !== ownerEmail) {
    return NextResponse.json(
      { error: "This account is not authorized for this private panel." },
      { status: 403 },
    );
  }

  return null;
}
