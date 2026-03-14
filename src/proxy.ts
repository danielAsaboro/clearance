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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  // For API routes, auth is checked in route handlers via getAuthUser
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
