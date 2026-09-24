"use client"
// Legacy local event previews must never generate a reusable attendance link.
export function EventQrDashboard({clubId}:{clubId:string}){return <section className="space-y-3 border-t py-5"><h2 className="font-semibold">Meeting attendance</h2><p className="text-sm text-muted-foreground">Open a persisted meeting to display its rotating attendance QR. Local event previews do not collect verified attendance.</p><a className="text-sm underline" href={`/meetings?clubId=${encodeURIComponent(clubId)}`}>Open club meetings</a></section>}
