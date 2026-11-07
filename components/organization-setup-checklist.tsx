"use client";
import { LoadingState } from "@/components/ui/loading-state"

import { onboardingFocus } from '@/lib/onboarding-presentation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRevalidate } from '@/hooks/use-revalidate';
import { CheckCircle2, Circle, XIcon } from '@/components/icons';
import { getOrganizationSetupChecklist } from '@/actions/organization-onboarding';
import { Button } from '@/components/ui/button';
import { canLeaveWorkspace } from '@/lib/product-navigation';
import { Panel } from "@/components/ui/panel";

export function OrganizationSetupChecklist({ clubId, compact = false }: { clubId: string; compact?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getOrganizationSetupChecklist>> | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Revalidation keeps the current checklist on screen; only a failed first read shows the error.
    let current = true; setFailed(false);
    getOrganizationSetupChecklist(clubId).then(value => { if (current) setData(value); }).catch(() => { if (current) { setData(null); setFailed(true); } });
    return () => { current = false; };
  }, [clubId, attempt]);
  useRevalidate(() => setAttempt(value => value + 1), { scopes: ["overview", "setup"], events: ["outclass:staffing-changed", "outclass:interview-rounds-changed"] });
  useEffect(() => {
    try { setDismissed(localStorage.getItem(`outclass:setup-intro:v1:${clubId}`) === 'dismissed'); } catch { setDismissed(false); }
  }, [clubId]);
  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(`outclass:setup-intro:v1:${clubId}`, 'dismissed'); } catch { /* Dismiss for this visit when storage is unavailable. */ }
  }
  if (dismissed) return null;
  if (failed) return <section className="mb-8 rounded-xl border p-4"><p role="alert" className="text-sm">Could not load organization setup progress.</p><Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Try again</Button></section>;
  if (!data) return <LoadingState label="Loading your organization setup checklist…" layout="rows" rows={2} />;
  const completed = data.steps.filter(step => step.complete).length, next = data.steps.find(step => !step.complete);
  return <Panel as="section" aria-label="Organization setup checklist" data-density={compact ? "compact" : "roomy"} className="oc-organization-checklist mb-8 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-muted-foreground">{next ? 'Welcome to your workspace' : 'Organization setup complete'}</p><h2 className="oc-section-heading mt-2 break-words">{next ? `Let’s get ${data.organizationName} ready` : `${data.organizationName} is ready`}</h2><p className="mt-2 text-sm text-muted-foreground">{completed} of {data.steps.length} complete · Progress comes from your saved organization data.</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label="Dismiss setup introduction" onClick={dismiss}><XIcon size={18} aria-hidden="true" /></Button></div></div>
    <details className="mt-4" open={compact ? undefined : !!next}><summary className={`min-h-11 cursor-pointer py-2 text-sm font-medium ${onboardingFocus}`}>{next ? 'Your setup checklist' : 'Review completed setup'}</summary><ol className="mt-4 grid gap-3 sm:grid-cols-2">{data.steps.map(step => <li key={step.id} className="flex items-start gap-3 rounded-lg border p-4">{step.complete ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="text-sm font-medium">{step.title}<span className="sr-only"> · {step.complete ? 'Complete' : 'Not complete'}</span></p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>{step.id !== 'claim' && <Link href={step.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault(); }} className={`mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${onboardingFocus}`}>{step.complete ? 'Review' : 'Continue'}<span className="sr-only"> · {step.title}</span></Link>}</div></li>)}</ol></details>
    {next && <Link href={next.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault(); }} className={`mt-4 inline-flex min-h-11 w-full items-center justify-center bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground sm:w-auto ${onboardingFocus}`}>Continue setup: {next.title}</Link>}
  </Panel>;
}
