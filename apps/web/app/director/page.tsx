import { DirectorHome } from "@/components/director/director-home";
export async function generateMetadata() {
  return {
    title: "ACTBYME Director — Edit the video before producing it",
    description:
      "Préparez, réalisez et prévisualisez vos publicités en 3D avant de générer vos clips IA.",
  };
}
export default function Page() {
  return <DirectorHome />;
}
