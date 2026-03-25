import { cookies } from "next/headers";
import ReferralCTA from "./ReferralCTA";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const cookieStore = await cookies();
  cookieStore.set("referral_code", code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });

  return <ReferralCTA code={code} />;
}
