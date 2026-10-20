import { DirectorEditor } from "@/components/director/director-editor";
export async function generateMetadata() {
  return {
    title: "The Coastal House — ACTBYME Director",
    description: "Demo project: a free 3D preview of a real estate ad.",
  };
}
export default function Page() {
  return <DirectorEditor />;
}
