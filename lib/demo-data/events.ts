import type { ClubEvent, CoffeeChatRequest, ManagedEvent } from "@/lib/data"
import type { ScheduleBlock } from "@/lib/scheduler"

function demoDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

function getDayNum(daysFromNow: number): number {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.getDate()
}

export const demoEvents: ClubEvent[] = [
  // Interest Meetings
  { id: "e-1", title: "SAMPLE DATA: Fall Interest Meeting", club: "Virginia Venture Fund", clubId: "vvf", type: "Interest Meeting", date: demoDate(-5), day: getDayNum(-5), time: "7:00 PM", color: "#232D4B" },
  { id: "e-2", title: "SAMPLE DATA: Info Session #1", club: "McIntire Investment Institute", clubId: "mii", type: "Interest Meeting", date: demoDate(-2), day: getDayNum(-2), time: "6:00 PM", color: "#1B5E3F" },
  { id: "e-3", title: "SAMPLE DATA: Fall Info Session", club: "Global Markets Group", clubId: "gmg", type: "Interest Meeting", date: demoDate(2), day: getDayNum(2), time: "8:00 PM", color: "#0B63E5" },
  { id: "e-4", title: "SAMPLE DATA: Meet the Execs", club: "TAMID", clubId: "tamid", type: "Interest Meeting", date: demoDate(5), day: getDayNum(5), time: "6:30 PM", color: "#A6192E" },
  { id: "e-5", title: "SAMPLE DATA: Open House", club: "180 Degrees Consulting", clubId: "180dc", type: "Interest Meeting", date: demoDate(8), day: getDayNum(8), time: "5:00 PM", color: "#EAAA00" },

  // Coffee Chats
  { id: "e-6", title: "SAMPLE DATA: Coffee Chat w/ President", club: "Virginia Venture Fund", clubId: "vvf", type: "Coffee Chat", date: demoDate(-1), day: getDayNum(-1), time: "10:00 AM", color: "#232D4B" },
  { id: "e-7", title: "SAMPLE DATA: Coffee Chat", club: "Alternative Investment Fund", clubId: "aif", type: "Coffee Chat", date: demoDate(1), day: getDayNum(1), time: "11:30 AM", color: "#1B5E3F" },
  { id: "e-8", title: "SAMPLE DATA: Coffee Chat", club: "American Marketing Association", clubId: "ama", type: "Coffee Chat", date: demoDate(3), day: getDayNum(3), time: "1:00 PM", color: "#0B63E5" },
  { id: "e-9", title: "SAMPLE DATA: Coffee Chat", club: "Alpha Kappa Psi", clubId: "akpsi", type: "Coffee Chat", date: demoDate(6), day: getDayNum(6), time: "2:00 PM", color: "#EAAA00" },
  { id: "e-10", title: "SAMPLE DATA: Coffee Chat", club: "Virginia Consulting Group", clubId: "vcg", type: "Coffee Chat", date: demoDate(10), day: getDayNum(10), time: "9:00 AM", color: "#232D4B" },

  // Deadlines
  { id: "e-11", title: "SAMPLE DATA: Application Deadline", club: "Virginia Venture Fund", clubId: "vvf", type: "Deadline", date: demoDate(1), day: getDayNum(1), time: "11:59 PM", color: "#232D4B" },
  { id: "e-12", title: "SAMPLE DATA: Written App Due", club: "180 Degrees Consulting", clubId: "180dc", type: "Deadline", date: demoDate(4), day: getDayNum(4), time: "11:59 PM", color: "#EAAA00" },
  { id: "e-13", title: "SAMPLE DATA: Resume Drop Deadline", club: "SEED", clubId: "seed", type: "Deadline", date: demoDate(7), day: getDayNum(7), time: "5:00 PM", color: "#1B5E3F" },
  { id: "e-14", title: "SAMPLE DATA: Application Deadline", club: "Portico Impact Fund", clubId: "portico", type: "Deadline", date: demoDate(9), day: getDayNum(9), time: "11:59 PM", color: "#0B63E5" },
  { id: "e-15", title: "SAMPLE DATA: Round 1 Deadline", club: "McIntire Investment Institute", clubId: "mii", type: "Deadline", date: demoDate(12), day: getDayNum(12), time: "11:59 PM", color: "#1B5E3F" },

  // Interview Slots
  { id: "e-16", title: "SAMPLE DATA: R1 Interview", club: "Virginia Venture Fund", clubId: "vvf", type: "Interview", date: demoDate(4), day: getDayNum(4), time: "4:00 PM", color: "#232D4B" },
  { id: "e-17", title: "SAMPLE DATA: R1 Interview", club: "Virginia Venture Fund", clubId: "vvf", type: "Interview", date: demoDate(4), day: getDayNum(4), time: "4:30 PM", color: "#232D4B" },
  { id: "e-18", title: "SAMPLE DATA: Technical Interview", club: "McIntire Investment Institute", clubId: "mii", type: "Interview", date: demoDate(5), day: getDayNum(5), time: "5:00 PM", color: "#1B5E3F" },
  { id: "e-19", title: "SAMPLE DATA: Case Interview", club: "180 Degrees Consulting", clubId: "180dc", type: "Interview", date: demoDate(6), day: getDayNum(6), time: "3:00 PM", color: "#EAAA00" },
  { id: "e-20", title: "SAMPLE DATA: Behavioral Interview", club: "TAMID", clubId: "tamid", type: "Interview", date: demoDate(7), day: getDayNum(7), time: "2:00 PM", color: "#A6192E" },
  { id: "e-21", title: "SAMPLE DATA: R1 Interview", club: "Virginia Consulting Group", clubId: "vcg", type: "Interview", date: demoDate(8), day: getDayNum(8), time: "1:00 PM", color: "#232D4B" },
  { id: "e-22", title: "SAMPLE DATA: Group Interview", club: "Alpha Kappa Psi", clubId: "akpsi", type: "Interview", date: demoDate(9), day: getDayNum(9), time: "6:00 PM", color: "#EAAA00" },
  { id: "e-23", title: "SAMPLE DATA: R1 Interview", club: "Global Markets Group", clubId: "gmg", type: "Interview", date: demoDate(10), day: getDayNum(10), time: "4:00 PM", color: "#0B63E5" },

  // Final Round
  { id: "e-24", title: "SAMPLE DATA: Final Round Superday", club: "Virginia Venture Fund", clubId: "vvf", type: "Interview", date: demoDate(11), day: getDayNum(11), time: "9:00 AM", color: "#232D4B" },
  { id: "e-25", title: "SAMPLE DATA: Final Partner Interview", club: "180 Degrees Consulting", clubId: "180dc", type: "Interview", date: demoDate(12), day: getDayNum(12), time: "1:00 PM", color: "#EAAA00" },
  { id: "e-26", title: "SAMPLE DATA: Final Presentation", club: "McIntire Investment Institute", clubId: "mii", type: "Interview", date: demoDate(14), day: getDayNum(14), time: "6:00 PM", color: "#1B5E3F" },
  { id: "e-27", title: "SAMPLE DATA: Final Round", club: "Portico Impact Fund", clubId: "portico", type: "Interview", date: demoDate(15), day: getDayNum(15), time: "3:00 PM", color: "#0B63E5" },

  // Other Events
  { id: "e-28", title: "SAMPLE DATA: Resume Workshop", club: "American Marketing Association", clubId: "ama", type: "Other", date: demoDate(-3), day: getDayNum(-3), time: "5:00 PM", color: "#0B63E5" },
  { id: "e-29", title: "SAMPLE DATA: Case Prep Workshop", club: "Virginia Consulting Group", clubId: "vcg", type: "Other", date: demoDate(1), day: getDayNum(1), time: "7:00 PM", color: "#232D4B" },
  { id: "e-30", title: "SAMPLE DATA: Social Mixer", club: "Alpha Kappa Psi", clubId: "akpsi", type: "Other", date: demoDate(5), day: getDayNum(5), time: "8:00 PM", color: "#EAAA00" },
];

export const demoCoffeeChatRequests: CoffeeChatRequest[] = [
  { id: "cc-1", leaderName: "Alex Rivera", leaderInitials: "AR", clubName: "Virginia Venture Fund", color: "#232D4B", status: "Pending", proposedSlots: [demoDate(1) + " 10:00 AM", demoDate(2) + " 11:00 AM"] },
  { id: "cc-2", leaderName: "Jordan Smith", leaderInitials: "JS", clubName: "McIntire Investment Institute", color: "#1B5E3F", status: "Confirmed", proposedSlots: [demoDate(3) + " 2:00 PM"] },
  { id: "cc-3", leaderName: "Casey Taylor", leaderInitials: "CT", clubName: "180 Degrees Consulting", color: "#EAAA00", status: "Pending", proposedSlots: [demoDate(4) + " 9:00 AM", demoDate(5) + " 1:00 PM"] },
  { id: "cc-4", leaderName: "Taylor Morgan", leaderInitials: "TM", clubName: "Virginia Consulting Group", color: "#232D4B", status: "Pending", proposedSlots: [demoDate(6) + " 3:00 PM", demoDate(7) + " 10:00 AM"] },
];

export const demoManagedEvents: ManagedEvent[] = [
  { id: "me-1", clubId: "vvf", title: "SAMPLE DATA: Round 1 Interviews", scope: "Members Only", date: demoDate(4), time: "4:00 PM", location: "Rouss Hall 411" },
  { id: "me-2", clubId: "mii", title: "SAMPLE DATA: Stock Pitch Workshop", scope: "Public", date: demoDate(2), time: "6:00 PM", location: "Clark Hall 108" },
];

export const demoScheduleBlocks: ScheduleBlock[] = [
  {
    id: "sb-1",
    date: demoDate(4),
    locationName: "Rouss Hall 411",
    mapUrl: "https://maps.google.com/?q=Rouss+Hall",
    slots: [
      { id: "sl-1", time: "4:00 PM", capacity: 1, bookedCount: 1, candidates: [{ name: "Demo Applicant", email: "demo@virginia.edu", initials: "DA" }] },
      { id: "sl-2", time: "4:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-3", time: "5:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-4", time: "5:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
    ]
  },
  {
    id: "sb-2",
    date: demoDate(5),
    locationName: "Clark Hall 107",
    mapUrl: "https://maps.google.com/?q=Clark+Hall",
    slots: [
      { id: "sl-5", time: "5:00 PM", capacity: 1, bookedCount: 1, candidates: [{ name: "Sample Student", email: "sample@virginia.edu", initials: "SS" }] },
      { id: "sl-6", time: "5:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-7", time: "6:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-8", time: "6:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-9", time: "7:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
    ]
  },
  {
    id: "sb-3",
    date: demoDate(6),
    locationName: "New Cabell Hall 332",
    mapUrl: "https://maps.google.com/?q=New+Cabell+Hall",
    slots: [
      { id: "sl-10", time: "3:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-11", time: "3:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-12", time: "4:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-13", time: "4:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-14", time: "5:00 PM", capacity: 1, bookedCount: 0, candidates: [] },
      { id: "sl-15", time: "5:30 PM", capacity: 1, bookedCount: 0, candidates: [] },
    ]
  }
];
