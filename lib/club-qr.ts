/** File name for a downloaded club QR code, e.g. "mcintire-investment-institute-qr-code". */
export function clubQrFilename(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "")
  return `${slug || "club"}-qr-code`
}
