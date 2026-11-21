export type ImportedImage = { contentType: "image/webp"; base64: string; source: string }

/** Suggested profile values read from a club's website. Nothing here is saved until a leader publishes. */
export type ImportedClubProfile = {
  /** The page that was read, after redirects. */
  source: string
  name: string
  tagline: string
  description: string
  color: string | null
  website: string
  email: string
  instagram: string
  linkedin: string
  links: { label: string; url: string }[]
  commitment: string
  logo: ImportedImage | null
  banner: ImportedImage | null
}
