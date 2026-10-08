"use client";
import { NativeSelect } from "@/components/ui/native-select"
import { getApplicationSettings } from "@/lib/workspace-read";
import { useEffect, useRef, useState } from "react";
import { Plus, ArrowUp, ArrowDown, Trash2, Eye } from "lucide-react";
import {
  saveApplicationSettings,
} from "@/actions/club-settings";
import {
  applicationSettingsSchema,
  type QuestionDraft,
} from "@/lib/club-settings";
import { QuestionField } from "@/components/applications/question-field";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "@/components/clubs/club-settings.css";
const localDate = (date: Date | string | null) => {
  if (!date) return "";
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function ApplicationBuilderView({
  clubId: provided,
}: {
  clubId?: string;
}) {
  const { activeClubId } = useAuth(),
    demo = useDemoMode(),
    clubId = provided || activeClubId;
  const [questions, setQuestions] = useState<QuestionDraft[]>([]),
    [open, setOpen] = useState(true),
    [deadline, setDeadline] = useState("");
  const [name, setName] = useState(""),
    [version, setVersion] = useState(0),
    [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0),
    [preview, setPreview] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({}),
    working = useRef(false);
  const snapshot = JSON.stringify({ questions, open, deadline }),
    dirty = loaded && snapshot !== baseline;
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled || !clubId) return;
    let current = true;
    setLoaded(false);
    setError("");
    getApplicationSettings(clubId)
      .then((data) => {
        if (current) {
          const date = localDate(data.applicationDeadline);
          setName(data.name);
          setQuestions(data.questions);
          setOpen(data.applicationOpen);
          setDeadline(date);
          setVersion(data.applicationVersion);
          setBaseline(
            JSON.stringify({
              questions: data.questions,
              open: data.applicationOpen,
              deadline: date,
            }),
          );
          setLoaded(true);
        }
      })
      .catch(() => {
        if (current)
          setError(
            "Could not load application settings. Check your access and retry.",
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
  function edit(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((items) =>
      items.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
    setNotice("");
  }
  function move(index: number, direction: number) {
    setQuestions((items) => {
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
    const input = {
      clubId,
      version,
      open,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      questions,
    };
    const parsed = applicationSettingsSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveApplicationSettings(input);
      setVersion(result.version);
      setBaseline(snapshot);
      setNotice(
        "Application settings saved. Students now see this configuration.",
      );
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
        Open a club workspace with application-management access to configure
        its application.
      </p>
    );
  if (demo.isDemoEnabled)
    return (
      <p className="text-sm text-muted-foreground">
        Application configuration is saved to your club outside Demo Mode. Exit
        Demo Mode to edit the live application.
      </p>
    );
  return (
    <div
      className="oc-settings-editor space-y-6"
      data-unsaved={dirty}
      data-saving={busy}
    >
      <div>
        <h2 className="oc-section-heading">Application</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your shared applicant profile already includes identity, academics,
          experience, and résumé. Add questions specific to your club.
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
                window.confirm(
                  "Discard unsaved application changes and reload?",
                )
              )
                setRetry((n) => n + 1);
            }}
          >
            Reload configuration
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {!loaded ? (
        !error && <p role="status">Loading application…</p>
      ) : (
        <>
          <fieldset
            disabled={busy}
            className="grid gap-4 border-b pb-6 sm:grid-cols-2"
          >
            <label className="inline-flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => setOpen(e.target.checked)}
              />
              Applications open
            </label>
            <label className="space-y-2 text-sm">
              Deadline (optional, your local time)
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </fieldset>
          <ol className="space-y-5">
            {questions.map((q, index) => (
              <li key={q.id} className="oc-settings-question">
                <fieldset disabled={busy} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="oc-card-heading">Question {index + 1}</h3>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Move question ${index + 1} up`}
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Move question ${index + 1} down`}
                        disabled={busy || index === questions.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove question ${index + 1}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Remove this question? Existing submitted answers will be retained.",
                            )
                          )
                            setQuestions((items) =>
                              items.filter((x) => x.id !== q.id),
                            );
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <label className="block space-y-2 text-sm">
                    Question
                    <Textarea
                      value={q.prompt}
                      maxLength={3000}
                      rows={3}
                      onChange={(e) => edit(q.id, { prompt: e.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="space-y-2 text-sm">
                      Response type
                      <NativeSelect
                        className="oc-settings-select"
                        value={q.type}
                        onChange={(e) =>
                          edit(q.id, {
                            type: e.target.value as QuestionDraft["type"],
                            options:
                              e.target.value === "MULTIPLE_CHOICE" &&
                              !q.options.length
                                ? ["Option 1", "Option 2"]
                                : q.options,
                          })
                        }
                      >
                        <option value="ESSAY">Written response</option>
                        <option value="MULTIPLE_CHOICE">Multiple choice</option>
                        <option value="FILE_UPLOAD">PDF / document link</option>
                      </NativeSelect>
                    </label>
                    <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          edit(q.id, { required: e.target.checked })
                        }
                      />
                      Required
                    </label>
                    {q.type === "ESSAY" && (
                      <label className="space-y-2 text-sm">
                        Maximum words (optional)
                        <Input
                          className="w-40"
                          type="number"
                          min={1}
                          max={10000}
                          value={q.wordLimit ?? ""}
                          onChange={(e) =>
                            edit(q.id, {
                              wordLimit: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                  {q.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-2">
                      <p className="text-sm">Answer choices</p>
                      {q.options.map((option, i) => (
                        <div className="flex gap-2" key={i}>
                          <Input
                            aria-label={`Question ${index + 1} option ${i + 1}`}
                            maxLength={300}
                            value={option}
                            onChange={(e) =>
                              edit(q.id, {
                                options: q.options.map((x, j) =>
                                  i === j ? e.target.value : x,
                                ),
                              })
                            }
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove option ${i + 1}`}
                            onClick={() =>
                              edit(q.id, {
                                options: q.options.filter((_, j) => i !== j),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={q.options.length >= 30}
                        onClick={() =>
                          edit(q.id, { options: [...q.options, ""] })
                        }
                      >
                        Add choice
                      </Button>
                    </div>
                  )}
                  {q.type === "FILE_UPLOAD" && (
                    <p className="text-xs text-muted-foreground">
                      Students can upload a PDF up to 10 MB or provide a
                      document link. Use their shared profile for a résumé.
                    </p>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>
          {!questions.length && (
            <p className="text-sm text-muted-foreground">
              No custom questions. Applications use the shared student profile.
            </p>
          )}
          <div className="oc-settings-actions">
            <Button
              variant="outline"
              disabled={busy || questions.length >= 100}
              onClick={() =>
                setQuestions((items) => [
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    prompt: "",
                    type: "ESSAY",
                    required: true,
                    wordLimit: null,
                    options: [],
                  },
                ])
              }
            >
              <Plus size={16} />
              Add question
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setPreview(true)}
            >
              <Eye size={16} />
              Preview as student
            </Button>
            <Button disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Saving…" : "Save application"}
            </Button>
          </div>
        </>
      )}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{name} application</DialogTitle>
            <DialogDescription>
              Preview of your current edits. Save to publish changes to
              students.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Identity, academics, experience, and résumé come from your shared
            profile.
          </p>
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <label
                  className="block text-sm font-medium"
                  htmlFor={`answer-${q.id}`}
                >
                  {i + 1}. {q.prompt || "Untitled question"} ·{" "}
                  {q.required ? "Required" : "Optional"}
                </label>
                <QuestionField
                  question={q}
                  value={responses[q.id] || ""}
                  onChange={(value) =>
                    setResponses((r) => ({ ...r, [q.id]: value }))
                  }
                />
                <p
                  id={`help-${q.id}`}
                  className="text-xs text-muted-foreground"
                >
                  {q.type === "ESSAY" && q.wordLimit
                    ? `Up to ${q.wordLimit} words`
                    : q.type === "FILE_UPLOAD"
                      ? "PDF or document link. Preview does not upload files."
                      : ""}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
