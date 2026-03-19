import { withAuth } from "next-auth/middleware";

export const middleware = withAuth({
  pages: {
    signIn: "/login",
  },
});

export default middleware;


export const config = {
  matcher: [
    "/",
    "/reports/:path*",
    "/roadmap/:path*",
    "/tracking/:path*",
    "/backlog/:path*",
    "/shifts/:path*",
    "/handovers/:path*",
    "/account/:path*",
    "/admin/:path*",
  ],
};
