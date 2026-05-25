import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "./button";

export function ShareProfileButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick}>
      <Share2 className="size-4 text-[#6366F1]" />
      Share
    </Button>
  );
}
