import { LeadView } from "@/components/lead-view";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const params = await searchParams;
  return <LeadView fixtureMode={params.fixture === "1"} />;
}
