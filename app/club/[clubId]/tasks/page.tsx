import { redirect } from "next/navigation"
export default async function Page({ params, searchParams }: {
  params: Promise<{ clubId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ clubId }, values] = await Promise.all([params, searchParams])
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item))
    else if (value !== undefined) query.set(key, value)
  })
  query.set("section", "tasks")
  redirect(`/club/${encodeURIComponent(clubId)}/workspace?${query}`)
}
