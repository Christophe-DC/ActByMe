import { DirectorEditor } from "@/components/director/director-editor";
export async function generateMetadata() {
  return {
    title: "Performance camera plan — ACTBYME Director",
    description: "Plan camera angles with a neutral stand-in and export a free video reference.",
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ legacy?: string }>;
}) {
  const query = await searchParams;
  return <DirectorEditor legacyDemo={query.legacy === "1"} />;
}
