"use client";
import { NativeSelect } from "@/components/ui/native-select"
import { getPipelineSettings } from "@/lib/workspace-read";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import {
  savePipelineSettings,
} from "@/actions/club-settings";
import {
  pipelineSettingsSchema,
  roundConfigurationSchema,
  roundTypes,
  roundTypeLabels,
  type RoundDraft,
} from "@/lib/club-settings";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecruitmentReviewSettings } from "@/components/recruitment-review-settings";
import { hasPermission } from "@/lib/permissions";
import "@/components/clubs/club-settings.css";
export function InterviewPipelineBuilderView({
  clubId: provided,
  onSaved,
}: {
  clubId?: string;
  onSaved?: () => void;
}) {
  const { activeClubId, user } = useAuth(),
    demo = useDemoMode(),
    clubId = provided || activeClubId;
  const [rounds, setRounds] = useState<RoundDraft[]>([]),
    [archived, setArchived] = useState<string[]>([]),
    [version, setVersion] = useState(0),
    [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0);
  const [savedRounds, setSavedRounds] = useState<
      { id: string; name: string; anonymousReview: boolean }[]
    >([]),
    working = useRef(false);
  const snapshot = JSON.stringify(rounds),
    dirty = loaded && snapshot !== baseline;
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled || !clubId) return;
    let current = true;
    setLoaded(false);
    setError("");
    getPipelineSettings(clubId)
      .then((data) => {
        if (!current) return;
        const items = data.pipelineRounds
          .filter((r) => !r.archivedAt)
          .map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type as RoundDraft["type"],
            configuration: roundConfigurationSchema.parse(r.configuration),
          }));
        setRounds(items);
        setBaseline(JSON.stringify(items));
        setVersion(data.pipelineVersion);
        setSavedRounds(data.pipelineRounds.filter((r) => !r.archivedAt));
        setArchived(
          data.pipelineRounds.filter((r) => r.archivedAt).map((r) => r.name),
        );
        setLoaded(true);
      })
      .catch(() => {
        if (current)
          setError(
            "Could not load recruiting rounds. Check your access and retry.",
          );
      });
    return () => {
      current = false;
    };
  }, [clubId, demo.ready, demo.isDemoEnabled, retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(id: string, patch: Partial<RoundDraft>) {
    setRounds((items) =>
      items.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setNotice("");
  }
  function move(index: number, direction: number) {
    setRounds((items) => {
      const next = [...items];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function save() {
    if (working.current) return;
    const input = { clubId, version, rounds },
      parsed = pipelineSettingsSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await savePipelineSettings(input);
      setBaseline(snapshot);
      setNotice("Recruiting pipeline saved.");
      setRetry((n) => n + 1);
      onSaved?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your edits are still here.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (!clubId)
    return (
      <p className="text-sm text-muted-foreground">
        Open a club workspace with recruiting-management access to configure its
        rounds.
      </p>
    );
  if (demo.isDemoEnabled)
    return (
      <p className="text-sm text-muted-foreground">
        Recruiting configuration is saved to your club outside Demo Mode. Exit
        Demo Mode to edit the live pipeline.
      </p>
    );
  return (
    <div
      className="oc-settings-editor space-y-6"
      data-unsaved={dirty}
      data-saving={busy}
    >
      <div>
        <h2 className="oc-section-heading">Recruiting Pipeline</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Order your workflow from initial application review to the final
          decision. Applicant progression, interview rooms, kits, and voting use
          these rounds.
        </p>
      </div>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm("Discard unsaved pipeline changes and reload?")
              )
                setRetry((n) => n + 1);
            }}
          >
            Reload pipeline
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {!loaded ? (
        !error && <p role="status">Loading pipeline…</p>
      ) : (
        <>
          <ol className="space-y-4">
            {rounds.map((r, i) => (
              <li className="oc-settings-question" key={r.id}>
                <fieldset disabled={busy} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Round {i + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Move ${r.name} up`}
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Move ${r.name} down`}
                        disabled={busy || i === rounds.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${r.name}`}
                        disabled={rounds.length === 1}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${r.name}? Active applicants and dependent rooms or voting sessions must be moved first. Historical records are retained.`,
                            )
                          )
                            setRounds((items) =>
                              items.filter((x) => x.id !== r.id),
                            );
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      Round name
                      <Input
                        maxLength={100}
                        value={r.name}
                        onChange={(e) => edit(r.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      Round type
                      <NativeSelect
                        className="oc-settings-select"
                        value={r.type}
                        onChange={(e) =>
                          edit(r.id, {
                            type: e.target.value as RoundDraft["type"],
                          })
                        }
                      >
                        {roundTypes.map((t) => (
                          <option value={t} key={t}>
                            {roundTypeLabels[t]}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  </div>
                  <label className="block space-y-2 text-sm">
                    Round instructions
                    <Textarea
                      maxLength={5000}
                      rows={3}
                      value={r.configuration.instructions}
                      onChange={(e) =>
                        edit(r.id, {
                          configuration: {
                            ...r.configuration,
                            instructions: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  {["INTERVIEW", "GROUP_INTERVIEW"].includes(r.type) && (
                    <>
                      <label className="block space-y-2 text-sm">
                        Default interview duration (minutes)
                        <Input
                          className="w-40"
                          type="number"
                          min={5}
                          max={180}
                          value={r.configuration.duration}
                          onChange={(e) =>
                            edit(r.id, {
                              configuration: {
                                ...r.configuration,
                                duration: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                      <Link
                        href={`/club/${clubId}/workspace?section=settings&setting=interviews`}
                        className="oc-profile-link"
                      >
                        Configure this round’s kit, rooms, and interviewer panel
                        ↗
                      </Link>
                    </>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="oc-settings-actions">
            <Button
              variant="outline"
              disabled={busy || rounds.length >= 50}
              onClick={() =>
                setRounds((items) => [
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    name: items.length
                      ? `Round ${items.length + 1}`
                      : "Application Review",
                    type: items.length ? "CUSTOM" : "APPLICATION_REVIEW",
                    configuration: { instructions: "", duration: 30 },
                  },
                ])
              }
            >
              <Plus size={16} />
              Add round
            </Button>
            <Button disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Saving…" : "Save pipeline"}
            </Button>
          </div>
          {archived.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Archived rounds (history retained): {archived.join(", ")}
            </p>
          )}
          <details className="border-t pt-5">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">
              Round privacy & applicant profile requirements
            </summary>
            <fieldset disabled={dirty || busy} className="mt-4">
              <RecruitmentReviewSettings
                clubId={clubId}
                rounds={savedRounds}
                canIdentify={hasPermission(
                  user?.memberships.find((m) => m.clubId === clubId),
                  "applicants.identify",
                )}
                embedded
                onChanged={() => {
                  setRetry((n) => n + 1);
                  onSaved?.();
                }}
              />
            </fieldset>
            {dirty && (
              <p className="mt-3 text-xs text-muted-foreground">
                Save pipeline changes before editing round privacy.
              </p>
            )}
          </details>
        </>
      )}
    </div>
  );
}
