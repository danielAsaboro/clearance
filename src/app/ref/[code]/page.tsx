import { cookies } from "next/headers";
import { Eye } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 bg-[#F5E642] rounded-2xl flex items-center justify-center mb-4">
        <Eye className="w-8 h-8 text-black" strokeWidth={2.5} />
      </div>
      <h1 className="text-3xl font-bold tracking-wider text-white mb-6">The Clearance</h1>

      <p className="text-white text-center text-lg font-bold mb-2">
        You&apos;ve been invited!
      </p>
      <p className="text-[#888] text-sm text-center mb-2">
        Join The Clearance and start earning through content creation.
      </p>
      <p className="text-[#555] text-xs text-center mb-8">
        Referrals are recorded on Solana&apos;s social graph via Tapestry
      </p>

      <div className="bg-[#1A1A1A] rounded-xl px-5 py-3 border border-[#2A2A2A] mb-8">
        <p className="text-[#888] text-xs uppercase tracking-wider mb-1">Referral Code</p>
        <p className="text-[#F5E642] font-bold text-lg">{code}</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <a
          href="/onboarding/step1?role=creator"
          className="btn-yellow w-full rounded-xl py-4 font-bold text-base flex items-center justify-center"
        >
          Join as Creator
        </a>
        <a
          href="/arena"
          className="w-full bg-[#1A1A1A] rounded-xl py-4 font-bold text-base text-white border border-[#2A2A2A] flex items-center justify-center"
        >
          Join as Fan
        </a>
      </div>
    </div>
  );
}
