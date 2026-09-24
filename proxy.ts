import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/orders/:path*",
    "/services/:path*",
    "/platforms/:path*",
    "/providers/:path*",
    "/refills/:path*",
    "/analytics/:path*",
    "/logs/:path*",
    "/settings/:path*",
    "/api/orders/:path*",
  ],
};
