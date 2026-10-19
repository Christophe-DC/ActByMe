import { DirectorEditor } from "@/components/director/director-editor";
export async function generateMetadata() {
  return {
    title: "The Coastal House — ACTBYME Director",
    description:
      "Projet de démonstration : prévisualisation 3D gratuite d’une publicité immobilière.",
  };
}
export default function Page() {
  return <DirectorEditor />;
}
