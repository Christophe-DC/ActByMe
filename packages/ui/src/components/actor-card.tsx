import * as React from "react";
import { Card } from "./card.js";

export function ActorCard({
  name,
  headline,
  avatar,
}: {
  name: string;
  headline?: string;
  avatar?: string;
}) {
  return (
    <Card className="flex items-center gap-3">
      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-[#0b0b0d]">
        {avatar ? (
          <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover" />
        ) : null}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#F9FAFB]">{name}</div>
        <div className="text-xs text-[#9CA3AF]">{headline}</div>
      </div>
    </Card>
  );
}
