/** Safe, code-generated placeholders; never a claim to be an official club logo. */
export function demoMonogram(name: string, color: string) {
  const letters = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="${color}"/><text x="48" y="54" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="26" font-weight="600">${letters}</text></svg>`)}`
}
