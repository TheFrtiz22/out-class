/** Joins short facts with " · " ("First Year · Round 1 · GPA 4.00"), skipping empty ones. */
export function joinFacts(...facts: (string | number | null | undefined | false)[]) {
  return facts.filter(fact => fact !== null && fact !== undefined && fact !== false && fact !== "").join(" · ")
}
