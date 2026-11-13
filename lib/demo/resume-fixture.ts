// Text items from the bundled fictional PDF, in the same order as PDF.js's text layer (one per line).
export const demoResumeLines = ["OutClass - Fictional Sample Resume", "Jordan Avery | Sample student", "Education: University of Virginia - Economics", "Research, data analysis, and student projects.", "This bundled PDF contains no real applicant data."] as const;
export const demoResumeText = demoResumeLines.join("");
