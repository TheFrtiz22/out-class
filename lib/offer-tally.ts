/**
 * Membership offers delivered for the Recruiting Overview "Decisions delivered" card.
 *
 * Input rows are grouped counts keyed by the current offer's status (null when the application has no offer).
 * - Sent: every current offer the applicant can see: PENDING, ACCEPTED, DECLINED or EXPIRED.
 * - Accepted: ACCEPTED only. Declined and expired offers were sent but not accepted.
 * - REVOKED offers (decision reversed or rescinded) and superseded offers are not counted as sent.
 * A PENDING offer past its expiry is reported as EXPIRED by the reader before it reaches this function.
 */
export type OfferTally = { sent: number; accepted: number; awaiting: number; declined: number; expired: number }

export function offerTally(rows: readonly { offer: string | null; count: number | bigint }[]): OfferTally {
  const tally: OfferTally = { sent: 0, accepted: 0, awaiting: 0, declined: 0, expired: 0 }
  for (const row of rows) {
    const count = Number(row.count)
    if (row.offer === "ACCEPTED") tally.accepted += count
    else if (row.offer === "PENDING") tally.awaiting += count
    else if (row.offer === "DECLINED") tally.declined += count
    else if (row.offer === "EXPIRED") tally.expired += count
    else continue
    tally.sent += count
  }
  return tally
}

/** "12 of 20 offers accepted"; null when no offer has been sent, so the card never shows 0 of 0. */
export function offerTallySummary(tally: OfferTally | null | undefined) {
  if (!tally || tally.sent === 0) return null
  return `${tally.accepted} of ${tally.sent} ${tally.sent === 1 ? "offer" : "offers"} accepted`
}
