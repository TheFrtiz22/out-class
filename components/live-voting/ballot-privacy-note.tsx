/** Verified against the server projections in lib/voting-room-projection.ts (live
 * rooms) and lib/voting-engine.ts projectLegacyVoting (board sessions): members
 * and leaders receive only their own ballot and a count while voting is open. */
export function BallotPrivacyNote({legacy=false}:{legacy?:boolean}){
  return <div className="vr-ballot-privacy text-sm text-muted-foreground">
    <p>Your choice is hidden from club members and leaders.</p>
    <details><summary className="cursor-pointer">Who can see ballots</summary>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>{legacy?"You can see your own ballot. Ballots in this session can’t be changed once submitted.":"You can see your own choice and change it while voting is open."}</li>
        <li>{legacy?"Everyone else, including leaders, sees only how many ballots are in while the pass is open, and only each applicant’s outcome after the pass is completed.":"Everyone else, including session leaders, sees only how many ballots are in while voting is open, and only the Pass, Hold and Do not pass totals after it closes."}</li>
        <li>In a small group, totals or outcomes can still let people work out how someone voted.</li>
        <li>Your ballot is stored with your account so OutClass can keep one vote per person. OutClass platform administrators can technically see stored ballots, through direct database access or an audited support session that views the app as you. Club leaders cannot.</li>
        <li>Leaders’ final decisions, overrides, interview comments and observations remain attributed to their authors.</li>
      </ul></details>
  </div>;
}
