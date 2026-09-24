"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signUp(
  _previous: { error: string } | null,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !name || password.length < 12) {
    return { error: "Name, email, and a password of at least 12 characters are required." };
  }

  if (
    process.env.PRIVATE_OWNER_EMAIL &&
    email !== process.env.PRIVATE_OWNER_EMAIL.trim().toLowerCase()
  ) {
    return { error: "Public registration is disabled for this private panel." };
  }

  const { error } = await auth.signUp.email({ email, name, password });

  if (error) {
    return { error: error.message || "Unable to create the owner account." };
  }

  redirect("/");
}
