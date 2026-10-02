"use client";

import { useRef, useState } from 'react';
import { sendRosterInvitations, deliverOrganizationInvitations } from '@/actions/invitation-emails';
import { Button } from '@/components/ui/button';

export function InvitationEmailControls({ clubId, importId, onSent }: { clubId: string; importId?: string; onSent?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const working = useRef(false);
  async function send() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    let sent = 0, failed = 0, cancelled = 0, uncertain = 0;
    try {
      if (importId) {
        const queued = await sendRosterInvitations(importId);
        setMessage(`${queued.queued} emails queued · ${queued.reused} already requested · ${queued.skipped} unavailable`);
      }
      while (true) {
        const result = await deliverOrganizationInvitations(clubId);
        sent += result.sent; failed += result.failed; cancelled += result.cancelled; uncertain += result.uncertain;
        setMessage(`${sent} emails sent · ${failed} failed · ${cancelled} cancelled · ${uncertain} need delivery review · ${result.remaining} queued`);
        if (!result.remaining) break;
        if (!result.sent && !result.failed && !result.cancelled && !result.uncertain) break;
      }
      try { await onSent?.(); } catch { setError('Delivery updated. Refresh members for current email statuses.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send invitations. Queued requests are retained; retry to continue.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Invitation email delivery" aria-busy={busy} data-saving={busy}>
    <p className="text-sm text-muted-foreground">Review invitations before emailing. Importing a CSV never sends emails automatically. Existing pending invitations from earlier imports are not emailed again by this import.</p>
    <Button disabled={busy} onClick={() => void send()}>{busy ? 'Sending invitations…' : importId ? 'Send invitations' : 'Send queued invitations'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
