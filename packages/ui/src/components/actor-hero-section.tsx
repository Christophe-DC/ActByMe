import * as React from "react";
import { Button } from "./button.js";

export function ActorHeroSection({
  name,
  headline,
  avatar,
}: {
  name: string;
  headline?: string;
  avatar?: string;
}) {
  return (
    <section className="rounded-lg border border-[#1F2937] bg-gradient-to-b from-[#0b0b0d] to-[#111827] p-8">
      <div className="flex items-center gap-6">
        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-[#0b0b0d]">
          {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[#F9FAFB]">{name}</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">{headline}</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline">Share profile</Button>
        </div>
      </div>
    </section>
  );
}
