import { discoverClubs, type DiscoverClub } from "@/lib/data"

// The managed VVF club is absent from the discovery fixtures. Include it in
// public routes so profile and attendance links resolve to the same club ID.
export const publicClubs: DiscoverClub[] = [...discoverClubs, {
  id: "vvf", name: "Virginia Venture Fund", logoText: "VVF", logoUrl: "/logos/vvf.webp",
  color: "#051B3D", category: "Finance", pitch: "Explore venture capital with the Virginia Venture Fund community.",
  tags: [], acceptanceRate: 8, aumValue: 100000, timeCommitment: "3-5",
}]
