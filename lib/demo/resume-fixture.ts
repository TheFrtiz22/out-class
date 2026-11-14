// Text items from the bundled fictional PDF, in the same order as PDF.js's text layer (one per line).
export const demoResumeLines = ["OutClass - Fictional Sample Resume", "Jordan Avery | Sample student", "Education: University of Virginia - Economics", "Research, data analysis, and student projects.", "This bundled PDF contains no real applicant data."] as const;
export const demoResumeText = demoResumeLines.join("");

/**
 * Fictional résumé text that Demo Mode summarizes. Summary only: the bundled PDF and its text layer
 * (demoResumeLines, used by annotation anchors) stay unchanged. No real person, school record or contact.
 */
export const demoResumeSummaryLines = [
  "Jordan Avery",
  "Charlottesville, VA | Sample student",
  "EDUCATION",
  "University of Virginia | B.A. Economics, Minor in Data Science Expected May 2028",
  "GPA: 3.8/4.0 | Dean's List",
  "EXPERIENCE",
  "Sample Analytics Co. | Data Analyst Intern Jun 2026 – Aug 2026",
  "• Built a weekly enrollment dashboard used by 40 students in a fictional pilot",
  "• Cleaned survey data and cut report preparation time by 30%",
  "Department of Economics | Research Assistant Sep 2025 – Present",
  "• Coded and summarized 200 survey responses for a faculty study",
  "LEADERSHIP & INVOLVEMENT",
  "Sample Consulting Club | Project Lead Jan 2026 – Present",
  "• Led a team of 5 members on a pro bono project for a local nonprofit",
  "PROJECTS",
  "Campus Dining Forecast Fall 2025",
  "• Forecast weekly demand with a regression model in Python",
  "SKILLS",
  "Languages: Python, SQL, R",
  "Tools: Excel, Tableau, Git",
] as const;
