import { DirectorHome } from "@/components/director/director-home";
export async function generateMetadata() {
  return {
    title: "ACTBYME Director — Edit the video before producing it",
    description: "Plan, direct and preview your ads in 3D before generating AI clips.",
  };
}
export default function Page() {
  return <DirectorHome />;
}
