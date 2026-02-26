import { NextRequest, NextResponse } from "next/server";

const publicPaths = [
  "/",
  "/auth",
  "/auth/login",
  "/arena",
  "/api/auth",
  "/ref",
];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// Static assets and Next.js internals
function isAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

/**
 * Role-based route guard.
 * Reads clearance_role/clearance_onboarded cookies to enforce
 * irreversible role-section access after onboarding:
 *   - Creators cannot access /arena/game (fan section)
 *   - Fans cannot access /creator-hub (creator section)
 */
function enforceRoleGuard(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get("clearance_role")?.value;
  const onboarded = req.cookies.get("clearance_onboarded")?.value === "1";

  // Only enforce after onboarding is complete
  if (!role || !onboarded) return null;

  // Creators cannot access fan arena game/results
  if (role === "creator" && pathname.startsWith("/arena/game")) {
    const url = req.nextUrl.clone();
    url.pathname = "/creator-hub";
    return NextResponse.redirect(url);
  }

  // Fans cannot access creator hub
  if (role === "fan" && pathname.startsWith("/creator-hub")) {
    const url = req.nextUrl.clone();
    url.pathname = "/arena";
    return NextResponse.redirect(url);
  }

  return null;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  // For API routes, auth is checked in route handlers via getAuthUser
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Enforce role-based routing — runs before public path check so
  // role-locked users can't access opposite-role sections even if "public"
  const roleRedirect = enforceRoleGuard(req);
  if (roleRedirect) return roleRedirect;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // For protected pages, check for Privy auth cookie
  const privyToken = req.cookies.get("privy-token");
  if (!privyToken) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
