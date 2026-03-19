import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export const middleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const pathname = req.nextUrl.pathname;

    // Admins always have full access
    if (token?.role === "ADMIN") return NextResponse.next();

    // For USER role, check permissions array
    const permissions: string[] = token?.permissions ?? [];

    // Exact match or prefix match (e.g. /chat matches /chat/123)
    const hasAccess = permissions.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!hasAccess) {
      // Redirect to first allowed page or /account if none
      const first = permissions[0] ?? "/account";
      return NextResponse.redirect(new URL(first, req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/chat/:path*",
    "/reports/:path*",
    "/clients/:path*",
    "/roadmap/:path*",
    "/tracking/:path*",
    "/backlog/:path*",
    "/shifts/:path*",
    "/events/:path*",
    "/handovers/:path*",
    "/knowledge/:path*",
    "/ai-config/:path*",
    "/account/:path*",
    "/admin/:path*",
  ],
};
