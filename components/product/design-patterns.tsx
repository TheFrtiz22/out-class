"use client"
import { useState, type ComponentProps } from "react"
import { toast } from "sonner"
import { DiscoveryCard } from "@/components/clubs/discovery-card"
import { ApplicationJourneyCard } from "@/components/applications/application-journey-card"
import { RecruitingOverview } from "@/components/recruiting-overview"
import { SlotCard } from "@/components/views/scheduler/slot-card"
import { PageHeader } from "@/components/product/page-header"
import { SegmentedControl } from "@/components/product/segmented-control"
import { demoMonogram } from "@/lib/demo/assets"
import { profileDraft } from "@/lib/club-marketing"
import { MarketingProfile } from "@/components/clubs/marketing-profile"
import type { DirectoryClub } from "@/lib/club-directory"
import "@/components/clubs/club-discovery.css"
import "@/components/clubs/explore-directory.css"
import "@/components/applications/application-tracker.css"

const clubs: DirectoryClub[] = [
  { id: "design-studio", name: "Campus Design Studio", logoText: "DS", logoUrl: demoMonogram("Design Studio", "#315b51"), color: "#315b51", category: "Creative", pitch: "Build thoughtful things with people who see the world a little differently.", tags: [], acceptanceRate: null, aumValue: null, timeCommitment: null, source: "preview" },
  { id: "campus-ventures", name: "Campus Ventures", logoText: "CV", logoUrl: demoMonogram("Campus Ventures", "#514961"), color: "#514961", category: "Entrepreneurship", pitch: "Turn a curious question into your next big idea. Start small, build together.", tags: [], acceptanceRate: null, aumValue: null, timeCommitment: null, source: "preview" },
  { id: "community-consulting", name: "Community Consulting", logoText: "CC", logoUrl: demoMonogram("Community Consulting", "#142d45"), color: "#142d45", category: "Service", pitch: "Real problems. Local partners. Work that makes a difference on Grounds and beyond.", tags: [], acceptanceRate: null, aumValue: null, timeCommitment: null, source: "preview" },
]
const overview: ComponentProps<typeof RecruitingOverview>["data"] = {
  club: { id: "design-studio", name: "Campus Design Studio", tagline: "Build something together." },
  membership: { id: "reference-member", isOwner: true, permissions: [] },
  meeting: null, work: [], awaitingReview: 3,
  recruitment: [{ status: "SUBMITTED", count: 24 }, { status: "IN_REVIEW", count: 12 }, { status: "INTERVIEWING", count: 8 }, { status: "ACCEPTED", count: 5 }, { status: "WAITLISTED", count: 3 }],
}
const options = ["Discovery", "Club profile", "Applications", "Recruitment", "Scheduling"]

/** Isolated visual fixtures. Never enables Demo Mode or touches account data. */
export function DesignPatterns() {
  const [view, setView] = useState("Discovery")
  const sampleAction = () => toast("Design reference only", { description: "This sample does not change account data." })
  return <section data-product-shell="personal" className="oc-pattern-reference" aria-label="Product pattern reference">
    <PageHeader eyebrow="Populated patterns · fictional reference data" title="One campus. One product." description="Actual product components with isolated visual examples. No account data or demo session is used." />
    <SegmentedControl label="Preview product patterns" options={options.map(label => ({label, value: label}))} value={view} onChange={setView} />
    <div className="oc-pattern-content" key={view}>
      {view === "Discovery" && <ul className="oc-explore-grid">{clubs.map(club => <DiscoveryCard key={club.id} club={club} entry={club.id} onOpen={sampleAction} />)}</ul>}
      {view === "Club profile" && <MarketingProfile profile={{ ...profileDraft(clubs[0]), tagline: "Design is better together.", marketing: { ...profileDraft(clubs[0]).marketing, benefits: ["Work on a campus project", "Learn from other student designers"], memberCount: 28, showMembers: true }, description: "Fictional visual reference." }} />}
      {view === "Applications" && <div className="oc-applications" data-application-scope="all"><ul className="oc-application-list">{clubs.map((club, index) => <li key={club.id}><ApplicationJourneyCard id={club.id} club={club} status={["DRAFTING", "INTERVIEWING", "ACCEPTED"][index]} round={["Applied", "Interview", "Final Decision"][index]} nextStep={["Your draft is ready. Pick up where you left off.", "Your next conversation is booked. Open your application for the details.", "Your decision is ready. Follow the club’s instructions for joining."][index]} onOpen={sampleAction} /></li>)}</ul></div>}
      {view === "Recruitment" && <RecruitingOverview data={overview} />}
      {view === "Scheduling" && <div><PageHeader title="Make room for a conversation." eyebrow="Sample interview day" description="Availability, capacity, and the next action in a single glance." /><div className="oc-slot-reference">{[0,1,2].map(index => <SlotCard key={index} onLaunch={sampleAction} slot={{ id: `reference-${index}`, time: ["2:00 PM", "2:30 PM", "3:00 PM"][index], capacity: 2, bookedCount: index, candidates: index ? [{ name: "Jordan Avery", email: "student@demo.invalid", initials: "JA" }, ...(index === 2 ? [{ name: "Amara Park", email: "sample@demo.invalid", initials: "AP" }] : [])] : [] }} />)}</div></div>}
    </div>
  </section>
}
