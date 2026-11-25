/** Plain names for what a task submission must include, shared by every task surface. */
export const taskRequirementNames: Record<string, string> = { TEXT: "Written response", LINK: "Link", FILE: "File upload" }

export function taskRequirementList(requirements: readonly string[]) {
  return requirements.map(type => taskRequirementNames[type] ?? type.charAt(0) + type.slice(1).toLowerCase())
}

/** "Written response + Link" for rows and summaries. */
export function taskRequirementsLabel(requirements: readonly string[]) {
  return taskRequirementList(requirements).join(" + ")
}

/** "written response and a link" for the Required sentence on the submission form. */
export function taskRequirementsSentence(requirements: readonly string[]) {
  const parts = taskRequirementList(requirements).map(name => name === "Link" ? "a link" : name === "File upload" ? "a file upload" : name.toLowerCase())
  return parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
}
