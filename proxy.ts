import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth(?:/|$)|api/auth(?:/|$)|api/orders/sync(?:/|$)).*)",
  ],
};
