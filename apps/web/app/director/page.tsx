import { DirectorHome } from "@/components/director/director-home";
export async function generateMetadata() {
  return {
    title: "ACTBYME Director — One performance, your camera plan",
    description:
      "Turn one actor performance into a camera plan. Preview angles and export a free reference MP4 for your AI video tool.",
  };
}
export default function Page() {
  return <DirectorHome />;
}
