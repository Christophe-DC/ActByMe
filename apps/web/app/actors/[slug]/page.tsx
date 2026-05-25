import { notFound } from "next/navigation";
import { ActorProfileExperience } from "../../../components/actor-profile-experience";
import { getActorBySlug, MOCK_ACTORS } from "../../../lib/mock-actors";

export function generateStaticParams() {
  return MOCK_ACTORS.map((actor) => ({
    slug: actor.slug,
  }));
}

export default async function ActorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = getActorBySlug(slug);

  if (!actor) {
    notFound();
  }

  return <ActorProfileExperience actor={actor} />;
}
