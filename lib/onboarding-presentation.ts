/** Presentation only: preserve table markup and headers while stacking rows on phones. */
export const onboardingTable = {
  table: "block w-full text-left text-sm sm:table",
  head: "sr-only sm:not-sr-only sm:table-header-group sm:bg-muted/50",
  body: "grid gap-3 p-3 sm:table-row-group sm:p-0",
  row: "grid grid-cols-2 overflow-hidden rounded-lg border bg-card sm:table-row sm:rounded-none sm:border-0 sm:border-t",
  cell: "min-w-0 break-words p-3 align-top before:mb-1 before:block before:text-xs before:font-medium before:text-muted-foreground before:content-[attr(data-label)] sm:before:hidden",
  wideCell: "col-span-2",
};
export const onboardingFocus = "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
