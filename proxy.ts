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
    "/new-order/:path*",
    "/api/orders/:path*",
    "/api/services/:path*",
    "/api/providers/:path*",
    "/api/refills/:path*",
    "/api/analytics/:path*",
    "/api/logs/:path*",
    "/api/settings/:path*",
  ],
};
