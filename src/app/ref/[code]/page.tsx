import { cookies } from "next/headers";
import Image from "next/image";

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
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
      <Image src="/spotr-logo.png" alt="Spotr TV" width={64} height={64} className="rounded-2xl mb-4" />
      <h1 className="text-3xl font-bold tracking-wider text-white mb-6">Spotr TV</h1>

      <p className="text-white text-center text-lg font-bold mb-2">
        You&apos;ve been invited!
      </p>
      <p className="text-[#888] text-sm text-center mb-2">
        Join Spotr TV and start predicting trending content.
      </p>
      <p className="text-[#555] text-xs text-center mb-8">
        Referrals are recorded on Solana&apos;s social graph via Tapestry
      </p>

      <div className="bg-[#1A1A1A] rounded-xl px-5 py-3 border border-[#2A2A2A] mb-8">
        <p className="text-[#888] text-xs uppercase tracking-wider mb-1">Referral Code</p>
        <p className="text-[#F5E642] font-bold text-lg">{code}</p>
      </div>

      <div className="w-full max-w-sm">
        <a
          href="/auth/login"
          className="btn-yellow w-full rounded-xl py-4 font-bold text-base flex items-center justify-center"
        >
          Join & Play
        </a>
      </div>
    </div>
  );
}
