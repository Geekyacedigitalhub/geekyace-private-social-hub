"use client";

import { useActionState } from "react";
import { signUp } from "./actions";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form action={formAction} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">GeekyAce</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Create owner account</h1>
        <p className="mt-2 text-sm text-slate-500">This route is restricted to the configured owner email.</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="name">Name</label>
        <input id="name" name="name" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" minLength={12} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />

        {state?.error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

        <button type="submit" disabled={pending} className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Creating..." : "Create owner account"}
        </button>
      </form>
    </main>
  );
}
