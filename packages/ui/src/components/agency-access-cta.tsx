import * as React from "react";
import { Button } from "./button.js";

export function AgencyAccessCTA({ onRequest }: { onRequest?: () => void }) {
  return (
    <div className="rounded-md border border-[#1F2937] bg-[#111827] p-4">
      <h3 className="text-sm font-semibold text-[#F9FAFB]">Agency access</h3>
      <p className="mt-1 text-xs text-[#9CA3AF]">
        Request curated access to talent profiles and reels.
      </p>
      <div className="mt-3">
        {onRequest ? (
          <Button onClick={onRequest}>Request access</Button>
        ) : (
          <Button asChild>
            <a href="/agency-access">Request access</a>
          </Button>
        )}
      </div>
    </div>
  );
}
