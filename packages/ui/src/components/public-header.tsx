import * as React from "react";
import { Clapperboard } from "lucide-react";
import { Button } from "./button.js";

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[#1F2937] py-4 px-6">
      <a className="flex items-center gap-3" href="/">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#6366F1]">
          <Clapperboard className="size-5 text-white" />
        </div>
        <div className="text-lg font-semibold text-[#F9FAFB]">ActByMe</div>
      </a>
      <nav className="flex items-center gap-2 sm:gap-3">
        <Button asChild variant="ghost">
          <a href="/actors">Actors</a>
        </Button>
        <Button asChild variant="ghost">
          <a href="/join">I&apos;am an actor</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/login">Login</a>
        </Button>
      </nav>
    </header>
  );
}
