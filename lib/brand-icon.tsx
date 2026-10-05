import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

/** Render the supplied mark at icon size; never replace or redraw the artwork. */
export async function brandIcon(size: number) {
  const artwork = await readFile(join(process.cwd(), "public/outclass-brand-mark.png"))
  return new ImageResponse(
    <div style={{ display: "flex", width: size, height: size }}>
      {/* A data URL embeds the existing artwork in the native metadata renderer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${artwork.toString("base64")}`} alt="" width={size} height={size} />
    </div>,
    { width: size, height: size },
  )
}
