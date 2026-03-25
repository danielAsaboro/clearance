import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const session = request.nextUrl.searchParams.get("session");

  const cookieStore = await cookies();
  cookieStore.set("referral_code", code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });

  const redirectUrl = new URL(`/ref/${code}/welcome`, request.url);
  if (session) redirectUrl.searchParams.set("session", session);

  return NextResponse.redirect(redirectUrl);
}
