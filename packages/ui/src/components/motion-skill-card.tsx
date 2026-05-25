"use client";

import * as React from "react";
import { motion } from "framer-motion";

export function MotionSkillCard({ title, excerpt }: { title: string; excerpt?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-md border border-[#1F2937] bg-[#111827] p-4"
    >
      <h4 className="text-sm font-semibold text-[#F9FAFB]">{title}</h4>
      {excerpt ? <p className="mt-2 text-xs text-[#9CA3AF]">{excerpt}</p> : null}
    </motion.div>
  );
}
