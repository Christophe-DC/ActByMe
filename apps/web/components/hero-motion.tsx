"use client";

import { motion } from "framer-motion";

const rows = [
  ["Acting Reel", "Voice", "Dance"],
  ["Martial Arts", "Stunts", "Singing"],
  ["Accents", "Motion Capture", "Presence"],
];

export function HeroMotion() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-[#1F2937] bg-[#111827]/86 p-5 shadow-2xl shadow-black/40"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
    >
      <div className="aspect-[4/5] overflow-hidden rounded-md border border-[#1F2937] bg-[#09090B] p-4">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="h-56 rounded-md border border-[#1F2937] bg-[linear-gradient(135deg,rgba(99,102,241,0.34),rgba(17,24,39,0.28)),url('https://images.unsplash.com/photo-1516834474-48c0abc2a902?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center" />
            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#9CA3AF]">Public profile</p>
                <h2 className="text-2xl font-semibold text-[#F9FAFB]">Maya Laurent</h2>
              </div>
              <span className="rounded-md bg-[#6366F1] px-3 py-2 text-sm font-medium text-white">
                Featured
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div className="grid grid-cols-3 gap-2" key={row.join("-")}>
                {row.map((item) => (
                  <div
                    className="rounded-md border border-[#1F2937] bg-[#111827] px-3 py-3 text-center text-xs text-[#9CA3AF]"
                    key={item}
                  >
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
