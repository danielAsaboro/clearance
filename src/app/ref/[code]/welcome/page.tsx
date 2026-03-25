import ReferralCTA from "../ReferralCTA";

export default async function ReferralWelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { code } = await params;
  const { session } = await searchParams;

  return <ReferralCTA code={code} session={session} />;
}
