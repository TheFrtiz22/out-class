import { SearchField, type SearchFieldProps } from "@/components/ui/search-field"

/** Kept for existing imports: the pill `SearchField` (clear button when `onClear` is given). */
export function Search(props: SearchFieldProps) {
  return <SearchField {...props} />
}
