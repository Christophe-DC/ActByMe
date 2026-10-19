import { DirectorEditor } from "@/components/director/director-editor";
export async function generateMetadata() {
  return { title: "Éditeur — ACTBYME Director", robots: { index: false, follow: false } };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectorEditor key={id} id={id} />;
}
