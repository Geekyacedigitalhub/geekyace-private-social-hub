"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signIn(
  _previous: { error: string } | null,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (
    process.env.PRIVATE_OWNER_EMAIL &&
    email !== process.env.PRIVATE_OWNER_EMAIL.trim().toLowerCase()
  ) {
    return { error: "This account is not authorized for this private panel." };
  }

  const { error } = await auth.signIn.email({ email, password });

  if (error) {
    return { error: error.message || "Unable to sign in." };
  }

  redirect("/");
}
