import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token as any)?.role;
    const path = req.nextUrl.pathname;
    const superadminOnly = ["/admin", "/audit-logs", "/settings/integrations"];
    if (superadminOnly.some(p => path.startsWith(p)) && role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/overview", req.url));
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token } }
);

export const config = {
  matcher: [
    "/overview/:path*",
    "/spice/:path*",
    "/client-requests/:path*",
    "/name-screening/:path*",
    "/needs-correction/:path*",
    "/pending-review/:path*",
    "/ready-for-part-a/:path*",
    "/human-handoff/:path*",
    "/forms/:path*",
    "/audit-logs/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
