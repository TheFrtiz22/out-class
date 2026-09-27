"use client"
import { useEffect, useState } from "react"
import { Plus, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { announcementExample, createAnnouncementPreview, type AnnouncementPreview } from "@/lib/announcement-preview"

/** Local presentation sandbox. No persistence, recipient lookup, or delivery calls. */
export function ClubAnnouncements() {
  const [previews, setPreviews] = useState<AnnouncementPreview[]>([])
  const [compose, setCompose] = useState(false), [selected, setSelected] = useState<string | null>(null)
  const [title, setTitle] = useState(""), [body, setBody] = useState(""), [error, setError] = useState("")
  const active = previews.find(item => item.id === selected)
  const dirty = !!title.trim() || !!body.trim()
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  return <div className="max-w-5xl space-y-7" data-unsaved={dirty}>
    <p role="note" className="max-w-3xl border-l-2 border-brand-orange pl-4 text-sm leading-7 text-muted-foreground"><strong className="font-medium text-foreground">Preview only.</strong> Announcements are not connected yet. Nothing here is published or delivered. Composed previews stay on this screen and disappear when you leave or reload.</p>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl">Announcement previews</h2><p className="mt-2 text-sm text-muted-foreground">Explore the layout and compose text before a publishing service is available.</p></div><Button onClick={() => { setSelected(null); setCompose(true) }}><Plus aria-hidden="true" className="size-4" />Compose preview</Button></div>
    {previews.length ? <ul className="divide-y border-y">{previews.map(item => <li key={item.id}><button type="button" className="flex w-full items-center justify-between gap-5 rounded py-5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring sm:px-3" onClick={() => { setSelected(item.id); setCompose(false) }}><span className="min-w-0"><span className="text-xs text-muted-foreground">Preview · audience not connected</span><span className="mt-2 block break-words font-medium">{item.title}</span><span className="mt-2 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{item.body}</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></button></li>)}</ul> : <section className="rounded-xl border bg-card px-6 py-10 sm:px-8"><h3 className="text-lg font-medium">No previews on this screen</h3><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">Compose an announcement to preview its presentation, or load a clearly labeled example. There is no production announcement history.</p><Button variant="outline" className="mt-5" onClick={() => setPreviews([announcementExample])}>Load example preview</Button></section>}
    {previews.length > 0 && <Button variant="ghost" onClick={() => { setPreviews([]); setSelected(null) }}>Clear local previews</Button>}
    <Sheet open={compose || !!active} onOpenChange={open => { if (!open) { setCompose(false); setSelected(null) } }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("workspace-content")?.focus() }}><SheetTitle>{compose ? "Compose announcement preview" : active?.title}</SheetTitle><SheetDescription>Preview only · no publishing, recipient selection, or delivery.</SheetDescription>
      {compose ? <form className="mt-7 space-y-6" onSubmit={event => { event.preventDefault(); try { const preview = createAnnouncementPreview(crypto.randomUUID(),title,body); setPreviews(items => [preview,...items]); setTitle(""); setBody(""); setError(""); setCompose(false); setSelected(preview.id) } catch(e) { setError(e instanceof Error ? e.message : "Could not create preview.") } }}>
        <label className="block space-y-2 text-sm font-medium">Title<Input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <div className="space-y-2"><label htmlFor="announcement-audience" className="text-sm font-medium">Audience</label><select id="announcement-audience" disabled aria-describedby="announcement-audience-help" className="min-h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground"><option>Audience selection not connected</option></select><p id="announcement-audience-help" className="text-xs leading-6 text-muted-foreground">This placeholder does not select members, applicants, or other recipients.</p></div>
        <label className="block space-y-2 text-sm font-medium">Announcement<Textarea required maxLength={10000} className="min-h-56" value={body} onChange={event => setBody(event.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={!title.trim() || !body.trim()}>Add to preview list</Button><p className="text-xs leading-6 text-muted-foreground">Closing this panel keeps your text while this screen stays open. Leaving the screen clears it.</p>
      </form> : active && <article className="mt-7 space-y-5"><p className="text-xs text-muted-foreground">Local preview · not published</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{active.body}</p><p className="border-t pt-4 text-xs text-muted-foreground">Audience and delivery are not connected. No email or message was sent.</p></article>}
    </SheetContent></Sheet>
  </div>
}
