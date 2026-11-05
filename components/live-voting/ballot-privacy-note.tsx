/** Verified against the server projections in lib/voting-room-projection.ts and
 * lib/voting-engine.ts (projectLegacyVoting): members and leaders receive only
 * their own ballot, a count while voting is open, and totals after closing. */
export function BallotPrivacyNote(){
  return <div className="vr-ballot-privacy text-sm text-muted-foreground">
    <p>Your choice is hidden from club members and leaders.</p>
    <details><summary className="cursor-pointer">Who can see ballots</summary>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>You can see and change your own choice while voting is open.</li>
        <li>Everyone else, including session leaders, sees only how many ballots are in while voting is open, and only the Pass, Hold and Do not pass totals after it closes.</li>
        <li>In a small group, totals can still let people work out how someone voted.</li>
        <li>Your ballot is stored with your account so OutClass can keep one vote per person. OutClass platform administrators with direct database access could technically see stored ballots; club leaders cannot.</li>
        <li>Leaders’ final decisions, overrides, interview comments and observations remain attributed to their authors.</li>
      </ul></details>
  </div>;
}
