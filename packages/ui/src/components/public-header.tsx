import * as React from "react";
import { Clapperboard } from "lucide-react";
import { Button } from "./button.js";

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[#1F2937] py-4 px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#6366F1]">
          <Clapperboard className="size-5 text-white" />
        </div>
        <div className="text-lg font-semibold text-[#F9FAFB]">ActByMe</div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost">About</Button>
        <Button variant="outline">Request access</Button>
      </div>
    </header>
  );
}
