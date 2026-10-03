"use client";

import { onboardingFocus } from '@/lib/onboarding-presentation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { getOrganizationSetupChecklist } from '@/actions/organization-onboarding';
import { Button } from '@/components/ui/button';
import { canLeaveWorkspace } from '@/lib/product-navigation';

export function OrganizationSetupChecklist({ clubId, compact = false }: { clubId: string; compact?: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getOrganizationSetupChecklist>> | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true; setData(null); setFailed(false);
    getOrganizationSetupChecklist(clubId).then(value => { if (current) setData(value); }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [clubId, attempt]);
  if (failed) return <section className="mb-8 rounded-xl border p-4"><p role="alert" className="text-sm">Could not load organization setup progress.</p><Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Retry setup checklist</Button></section>;
  if (!data) return <p role="status" className="mb-8 text-sm text-muted-foreground">Loading your organization setup checklist…</p>;
  const completed = data.steps.filter(step => step.complete).length, next = data.steps.find(step => !step.complete);
  return <section aria-label="Organization setup checklist" data-density={compact ? "compact" : "roomy"} className="oc-organization-checklist mb-8 rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-muted-foreground">{next ? 'Welcome to your workspace' : 'Organization setup complete'}</p><h2 className="oc-section-heading mt-2 break-words">{next ? `Let’s get ${data.organizationName} ready` : `${data.organizationName} is ready`}</h2><p className="mt-2 text-sm text-muted-foreground">{completed} of {data.steps.length} complete · Progress comes from your saved organization data.</p></div><Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Refresh progress</Button></div>
    <details className="mt-4" open={compact ? undefined : !!next}><summary className={`min-h-11 cursor-pointer py-2 text-sm font-medium ${onboardingFocus}`}>{next ? 'Your setup checklist' : 'Review completed setup'}</summary><ol className="mt-4 grid gap-3 sm:grid-cols-2">{data.steps.map(step => <li key={step.id} className="flex items-start gap-3 rounded-lg border p-4">{step.complete ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="text-sm font-medium">{step.title}<span className="sr-only"> · {step.complete ? 'Complete' : 'Not complete'}</span></p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>{step.id !== 'claim' && <Link href={step.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault(); }} className={`mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${onboardingFocus}`}>{step.complete ? 'Review' : 'Continue'}<span className="sr-only"> · {step.title}</span></Link>}</div></li>)}</ol></details>
    {next && <Link href={next.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault(); }} className={`mt-4 inline-flex min-h-11 w-full items-center justify-center bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground sm:w-auto ${onboardingFocus}`}>Continue setup: {next.title}</Link>}
  </section>;
}
