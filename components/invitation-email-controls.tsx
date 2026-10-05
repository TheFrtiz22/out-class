"use client";

import { useRef, useState } from 'react';
import { sendRosterInvitations, requestInvitationDelivery } from '@/actions/invitation-emails';
import { Button } from '@/components/ui/button';

export function InvitationEmailControls({ clubId, importId, onSent }: { clubId: string; importId?: string; onSent?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const working = useRef(false);
  async function send() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      if (importId) {
        const queued = await sendRosterInvitations(importId);
        setMessage(`${queued.queued} emails queued · ${queued.reused} already requested · ${queued.skipped} unavailable. Delivery continues in the background.`);
      } else {
        await requestInvitationDelivery(clubId);
        setMessage('Queued invitation delivery requested. You can keep working while emails are sent. Refresh members to see delivery status.');
      }
      try { await onSent?.(); } catch { setError('Delivery updated. Refresh members for current email statuses.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not queue invitations. Saved invitations are retained; retry to continue.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-label="Invitation email delivery" aria-busy={busy} data-saving={busy}>
    <p className="text-sm leading-6 text-muted-foreground">Review invitations before emailing. Importing a CSV never sends emails automatically. Existing pending invitations from earlier imports are not emailed again by this import.</p>
    <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={() => void send()}>{busy ? 'Queueing invitations…' : importId ? 'Send invitations' : 'Send queued invitations'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
