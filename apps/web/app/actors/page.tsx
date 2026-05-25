"use client";

import { useState, useMemo } from "react";
import { Search, Zap } from "lucide-react";
import { Badge, Button } from "@actbyme/ui";
import { Card } from "../../../packages/ui/src/components/card";
import { DemoProfileBadge } from "../../../packages/ui/src/components/demo-profile-badge";
import Link from "next/link";
import {
  MOCK_ACTORS,
  searchActors,
  filterActors,
  sortActors,
  ALL_LANGUAGES,
  ALL_ACCENTS,
  ALL_SKILLS,
  ALL_MOTION_CATEGORIES,
} from "../../lib/mock-actors";

type SortOption = "featured" | "score" | "newest";

export default function ActorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedAccent, setSelectedAccent] = useState<string>("");
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedMotionCategory, setSelectedMotionCategory] = useState<string>("");

  const results = useMemo(() => {
    let filtered = searchQuery ? searchActors(searchQuery) : MOCK_ACTORS;

    filtered = filterActors(filtered, {
      language: selectedLanguage || undefined,
      accent: selectedAccent || undefined,
      skill: selectedSkill || undefined,
      motionSkill: selectedMotionCategory || undefined,
    });

    return sortActors(filtered, sortBy);
  }, [
    searchQuery,
    sortBy,
    selectedLanguage,
    selectedAccent,
    selectedSkill,
    selectedMotionCategory,
  ]);

  return (
    <main className="w-full py-12 px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-2">Discover actors</h1>
          <p className="text-lg text-[#9CA3AF]">
            Find talented performers ready for AI video production
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 size-5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search by name, skill, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-lg pl-12 pr-4 py-3 text-[#F9FAFB] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1]"
            />
          </div>
        </div>

        {/* Filters & Sort */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          {/* Language Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#F9FAFB] mb-2">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-md px-3 py-2 text-[#F9FAFB] text-sm focus:outline-none focus:border-[#6366F1]"
            >
              <option value="">All languages</option>
              {ALL_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Accent Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#F9FAFB] mb-2">Accent</label>
            <select
              value={selectedAccent}
              onChange={(e) => setSelectedAccent(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-md px-3 py-2 text-[#F9FAFB] text-sm focus:outline-none focus:border-[#6366F1]"
            >
              <option value="">All accents</option>
              {ALL_ACCENTS.map((accent: string) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </select>
          </div>

          {/* Skill Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#F9FAFB] mb-2">Skill</label>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-md px-3 py-2 text-[#F9FAFB] text-sm focus:outline-none focus:border-[#6366F1]"
            >
              <option value="">All skills</option>
              {ALL_SKILLS.map((skill: string) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>

          {/* Motion Category Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#F9FAFB] mb-2">Motion</label>
            <select
              value={selectedMotionCategory}
              onChange={(e) => setSelectedMotionCategory(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-md px-3 py-2 text-[#F9FAFB] text-sm focus:outline-none focus:border-[#6366F1]"
            >
              <option value="">All motion</option>
              {ALL_MOTION_CATEGORIES.map((cat: string) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-semibold text-[#F9FAFB] mb-2">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-md px-3 py-2 text-[#F9FAFB] text-sm focus:outline-none focus:border-[#6366F1]"
            >
              <option value="featured">Featured</option>
              <option value="score">Highest score</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 text-sm text-[#9CA3AF]">
          Showing {results.length} actor{results.length !== 1 ? "s" : ""}
        </div>

        {/* Actor Grid */}
        {results.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {results.map((actor: any) => (
              <Link key={actor.id} href={`/actors/${actor.slug}`}>
                <Card className="group cursor-pointer hover:border-[#6366F1] transition-all hover:shadow-lg h-full flex flex-col">
                  {/* Profile Image/Video Placeholder */}
                  <div className="aspect-square rounded-md bg-gradient-to-br from-[#0b0b0d] to-[#111827] mb-4 flex items-center justify-center overflow-hidden">
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-full bg-[#6366F1]/20 mx-auto mb-2" />
                      <p className="text-xs text-[#9CA3AF]">{actor.name}</p>
                    </div>
                  </div>

                  {/* Name & Location */}
                  <h3 className="font-semibold text-[#F9FAFB] mb-1">{actor.name}</h3>
                  <p className="text-xs text-[#9CA3AF] mb-3">{actor.location}</p>

                  {/* Languages */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {actor.languages.slice(0, 2).map((lang: string) => (
                      <Badge key={lang} className="text-xs px-2 py-0.5">
                        {lang}
                      </Badge>
                    ))}
                  </div>

                  {/* Top Skills */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {actor.skills.slice(0, 2).map((skill: string) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 text-xs bg-[#6366F1]/10 text-[#6366F1] px-2 py-1 rounded"
                      >
                        <Zap className="size-3" />
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Act AI Score */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6366F1] rounded-full"
                        style={{ width: `${actor.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#6366F1]">{actor.score}</span>
                  </div>

                  {/* Demo Badge */}
                  {actor.isDemo && (
                    <div className="mb-3">
                      <DemoProfileBadge />
                    </div>
                  )}

                  {/* CTA */}
                  <Button variant="outline" size="sm" className="w-full mt-auto">
                    View profile
                  </Button>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[#9CA3AF]">
              No actors found matching your criteria. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
