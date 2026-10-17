/** Public employer artwork, not an endorsement or a placement claim.
 * Clubs select names; this registry only improves their presentation.
 * Provenance: docs/club-profile-design/employer-marks.json. */
const marks: Record<string, string> = {
  "blackstone": "/employers/employer-blackstone.png",
  "morgan stanley": "/employers/employer-morgan-stanley.png",
  "evercore": "/employers/employer-evercore.png",
  "guggenheim partners": "/employers/employer-guggenheim-partners.png",
  "boston consulting group": "/employers/employer-boston-consulting-group.png",
  "google": "/employers/employer-google.png",
  "mckinsey & company": "/employers/seed-extra-22.png",
  "bain & company": "/employers/seed-extra-21.png",
  "citadel": "/employers/seed-extra-23.png",
  "amazon": "/employers/seed-extra-24.png",
  "j.p. morgan": "/employers/seed-extra-25.png",
  "goldman sachs": "/employers/seed-extra-26.png"
};
export function employerMark(name: string): string | undefined {
  return marks[name.trim().toLowerCase()];
}
