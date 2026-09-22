import { UserRound, Search, FileText, ChartNoAxesColumnIncreasing } from "lucide-react"
import { SectionReveal, StaggerReveal, TextReveal } from "@/components/motion/scroll-motion"
const steps = [
  {
    icon: UserRound,
    title: "Build your profile",
    copy: "Your experience, your interests, your story. All in one place.",
    href: "#students",
  },
  {
    icon: Search,
    title: "Discover opportunities",
    copy: "Find clubs that share your curiosity and ambition.",
    href: "#discover-clubs",
  },
  {
    icon: FileText,
    title: "Apply with ease",
    copy: "Make each application your own. Leave the retyping behind.",
    href: "#apply",
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: "Track & succeed",
    copy: "Stay close to every update, interview, and next step.",
    href: "#track",
  },
]
export function ProcessTimeline() {
  return (
    <SectionReveal id="about" className="oc-process" aria-labelledby="process-title">
      <p data-motion="context" className="oc-story-eyebrow">
        FROM INTEREST TO IMPACT
      </p>
      <TextReveal asChild>
        <h2 id="process-title">A simpler recruiting experience.</h2>
      </TextReveal>
      <StaggerReveal className="oc-process-steps">
        {steps.map(({ icon: Icon, title, copy, href }, index) => (
          <a key={title} href={href}>
            <span className="oc-process-icon">
              <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="oc-process-number">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </a>
        ))}
      </StaggerReveal>
    </SectionReveal>
  )
}
