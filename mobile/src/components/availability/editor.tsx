import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { DayGrid } from "~/components/availability/day-grid";
import { ChevronLeft, ChevronRight, Copy } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, IconButton, Press, Segmented, TARGET } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import {
  SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL, WEEK_DAYS, addDays, availabilityEditorDays, availabilityEditorKnownDays, dayIndex, editAvailabilityDays, monday,
  readDocument, restoreVisibleRecurring, sameSchedule, today, visibleHours, type AvailabilityDocument, type AvailabilitySchedule, type MyAvailability, type RoundAvailability,
} from "~/lib/availability";
import { useAutosave } from "~/lib/autosave";
import { formatDateKey } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

export type RoundScope = { clubId: string; roundId: string };
type Status = { confirmed: boolean; declined: boolean };
type Mode = "recurring" | "week";

/** A save whose answer was lost counts only when the server now holds exactly this edit (lib/availability-save-recovery.ts). */
async function saveWithRecovery(payload: AvailabilityDocument, save: () => Promise<AvailabilityDocument>, read: () => Promise<{ document: AvailabilityDocument; responseMatches: boolean }>) {
  try { return await save(); } catch (error) {
    try {
      const current = await read();
      if (payload.accountId && current.document.accountId === payload.accountId && current.document.revision === payload.revision + 1 && current.responseMatches && sameSchedule(current.document.schedule, payload.schedule)) return current.document;
    } catch { /* Keep the original error and the edits. */ }
    throw error;
  }
}
const readRound = async (scope: RoundScope) => { const value = await api.get<RoundAvailability>("availability.round", scope); return { ...value, document: readDocument(value.document) }; };

/**
 * The availability editor (web: components/availability/my-availability.tsx AvailabilityEditor). Edits
 * save on their own a moment after each change, with the revision that was loaded, and an unsaved copy
 * is kept on this device until it reaches OutClass. With `scope` it edits one club and round's own
 * response and adds Submit, Withdraw and Decline.
 */
export function AvailabilityEditor({ initial, scope, title, initialWeek, initialStatus, readOnly, onSaved, onStatus, onReload, onPaintingChange }: {
  initial: AvailabilityDocument; scope?: RoundScope; title: string; initialWeek?: string; initialStatus?: Status; readOnly?: boolean; onPaintingChange?: (painting: boolean) => void;
  onSaved?: (document: AvailabilityDocument) => void; onStatus?: (status: Status) => void; onReload: () => void;
}) {
  const { colors } = useTheme();
  const [schedule, setSchedule] = useState<AvailabilitySchedule>(initial.schedule);
  const revision = useRef(initial.revision);
  const [status, setStatusState] = useState<Status>(initialStatus ?? { confirmed: false, declined: false });
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>(scope || initial.schedule.timezone !== SCHEDULING_TIMEZONE ? "week" : "recurring");
  const [week, setWeek] = useState(() => initialWeek ?? monday(today()));
  const [day, setDay] = useState(() => dayIndex(today()));
  const [copying, setCopying] = useState(false);
  const setStatus = (next: Status) => { setStatusState(next); onStatus?.(next); };

  const document = (value: AvailabilitySchedule): AvailabilityDocument => ({ accountId: initial.accountId, schedule: value, revision: revision.current });
  const autosave = useAutosave<AvailabilitySchedule>({
    identity: `availability:${scope ? `${scope.clubId}:${scope.roundId}` : "global"}`,
    owner: initial.accountId,
    value: schedule,
    restore: setSchedule,
    enabled: !readOnly,
    save: async value => {
      const payload = document(value);
      const saved = await saveWithRecovery(payload,
        async () => scope ? readDocument((await api.post<{ document: AvailabilityDocument }>("availability.round.save", { ...payload, ...scope, confirm: false })).document) : readDocument(await api.post<AvailabilityDocument>("availability.save", payload)),
        async () => {
          if (scope) { const current = await readRound(scope); return { document: current.document, responseMatches: !current.confirmed && !current.declined }; }
          return { document: readDocument((await api.get<MyAvailability>("availability.mine")).document), responseMatches: true };
        });
      revision.current = saved.revision;
      onSaved?.(saved);
    },
  });

  const recurring = mode === "recurring";
  const days = useMemo(() => availabilityEditorDays(schedule, week, recurring), [schedule, week, recurring]);
  const knownDays = useMemo(() => recurring ? Array(7).fill(schedule.weeklySubmitted) as boolean[] : availabilityEditorKnownDays(schedule, week), [schedule, week, recurring]);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const locked = !!readOnly || working || !!autosave.recovery;

  function change(next: AvailabilitySchedule) {
    if (locked || sameSchedule(next, schedule)) return;
    // Any change to a round response takes it back to not submitted, as the server does.
    if (scope && (status.confirmed || status.declined)) setStatus({ confirmed: false, declined: false });
    setNotice("");
    setSchedule(next);
  }
  const editDays = (next: boolean[][], changed: number[]) => change(editAvailabilityDays(schedule, week, recurring, next, changed));
  const clear = (indices: number[]) => editDays(days.map((cells, i) => indices.includes(i) ? cells.map(() => false) : cells), indices);
  function copyTo(targets: number[]) {
    if (!knownDays[day]) { setNotice("The source day has no submitted availability."); return; }
    editDays(days.map((cells, i) => targets.includes(i) ? [...days[day]] : cells), targets);
  }
  function copyPrevious() {
    const previous = availabilityEditorDays(schedule, addDays(week, -7), false);
    const indices = availabilityEditorKnownDays(schedule, addDays(week, -7)).flatMap((known, i) => known ? [i] : []);
    if (!indices.length) { setNotice("Last week has no submitted availability to copy."); return; }
    editDays(previous, indices);
  }

  async function act(run: () => Promise<void>, failure: string) {
    if (working) return;
    setWorking(true); setNotice("");
    try { await run(); } catch (error) { haptics.error(); setNotice(errorMessage(error, failure)); } finally { setWorking(false); }
  }
  const submitRound = () => act(async () => {
    if (!scope) return;
    await autosave.flush();
    const payload = document(schedule);
    const saved = await saveWithRecovery(payload,
      async () => readDocument((await api.post<{ document: AvailabilityDocument }>("availability.round.save", { ...payload, ...scope, confirm: true })).document),
      async () => { const current = await readRound(scope); return { document: current.document, responseMatches: current.confirmed && !current.declined }; });
    revision.current = saved.revision; await autosave.reset();
    setStatus({ confirmed: true, declined: false }); haptics.confirm();
  }, "Could not confirm participation.");
  const withdraw = () => act(async () => {
    if (!scope) return;
    await autosave.flush();
    const result = await api.post<{ document: AvailabilityDocument }>("availability.round.save", { ...document(schedule), ...scope, confirm: false });
    revision.current = readDocument(result.document).revision; await autosave.reset();
    setStatus({ confirmed: false, declined: false });
  }, "Could not withdraw confirmation.");
  const decline = () => act(async () => {
    if (!scope) return;
    await autosave.flush();
    const result = await api.post<{ revision: number }>("availability.round.decline", { ...scope, revision: revision.current, accountId: initial.accountId });
    revision.current = result.revision; await autosave.reset();
    setStatus({ confirmed: false, declined: true });
  }, "Could not decline participation.");
  const useGlobal = () => act(async () => {
    if (!scope) return;
    const latest = await readRound(scope);
    const global = readDocument({ schedule: latest.global }).schedule;
    if (sameSchedule(global, schedule)) { setNotice("Already using your current global schedule. Your response is unchanged."); return; }
    if (status.confirmed || status.declined) setStatus({ confirmed: false, declined: false });
    setSchedule(global);
  }, "Could not refresh the global schedule.");

  const saveText = autosave.state === "saving" ? "Saving…"
    : autosave.state === "offline" || autosave.state === "unreachable" ? autosave.error
    : autosave.state === "error" ? "Save failed · edits retained"
    : autosave.dirty ? "Unsaved changes"
    : revision.current === 0 ? "No schedule saved" : "All changes saved";
  const stale = autosave.state === "error" && autosave.error && /another tab|reload/i.test(autosave.error);
  const dayName = WEEK_DAYS[day];
  const dateLabel = (i: number) => formatDateKey(dates[i], { month: "short", day: "numeric" });
  const hasDateChange = !recurring && schedule.timezone === SCHEDULING_TIMEZONE && Object.hasOwn(schedule.exceptions, dates[day]);
  const unsubmitted = !schedule.weeklySubmitted && !Object.keys(schedule.exceptions).length;

  return (
    <View style={{ gap: 12 }} testID="availability-editor">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <Text variant="section" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={3}>{title}</Text>
          {readOnly ? null : <Text testID="availability-save-state" variant="caption" color={autosave.state === "error" ? colors.destructive : colors.mutedForeground} accessibilityLiveRegion="polite" style={{ maxWidth: "50%", textAlign: "right" }}>{saveText}</Text>}
        </View>
        <Text variant="small">{scope ? "Your global schedule is prefilled. Adjust specific dates here and confirm your participation for this club and round." : "Enter your usual free time once. Your schedule follows local clock time, including daylight saving changes."}</Text>
        <Text variant="caption">8:00 AM–9:00 PM · {SCHEDULING_TIMEZONE_LABEL}</Text>
        {!scope && schedule.timezone === SCHEDULING_TIMEZONE ? (
          <Segmented<Mode> label="Availability editing mode" value={mode} onChange={setMode} options={[{ value: "recurring", label: "Recurring week" }, { value: "week", label: "Specific dates" }]} />
        ) : null}
        {autosave.state === "error" && autosave.error ? (
          <View style={{ gap: 8 }}>
            <Text variant="small" color={colors.destructive} accessibilityRole="alert">{autosave.error}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {stale ? null : <Button size="compact" variant="secondary" label="Retry save" onPress={() => { void autosave.flush().catch(() => {}); }} />}
              <Button size="compact" variant="secondary" testID="availability-reload" label="Reload saved version" onPress={onReload} />
            </View>
          </View>
        ) : autosave.state === "offline" || autosave.state === "unreachable" ? (
          <Button size="compact" variant="secondary" label="Retry save" onPress={() => { void autosave.flush().catch(() => {}); }} />
        ) : null}
      </Card>

      {autosave.recovery ? (
        <Card tone="soft" style={{ gap: 10 }} testID="availability-recovery">
          {autosave.recoveryKind === "conflict" ? (
            <>
              <Text variant="small">This device has changes from before a newer version was saved elsewhere.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button size="compact" variant="secondary" label="Keep newer version" onPress={() => { void autosave.discardRecovery(); }} />
                {autosave.reviewing ? null : <Button size="compact" variant="ghost" label="Review my copy" onPress={autosave.reviewRecovery} />}
              </View>
              {autosave.reviewing ? (
                <View style={{ gap: 6 }}>
                  <Text variant="smallStrong">Your earlier copy for {dayName} (read-only)</Text>
                  <DayGrid testID="availability-review" readOnly dayName={dayName} known={recurring ? autosave.recovery.weeklySubmitted : availabilityEditorKnownDays(autosave.recovery, week)[day]} cells={availabilityEditorDays(autosave.recovery, week, recurring)[day]} />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text variant="small">Unsaved availability from this device is available.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button size="compact" label="Restore edits" testID="availability-restore" onPress={autosave.restoreRecovery} />
                <Button size="compact" variant="ghost" label="Discard" onPress={() => { void autosave.discardRecovery(); }} />
              </View>
            </>
          )}
        </Card>
      ) : null}

      {scope ? (
        <Card style={{ gap: 10 }} testID="availability-round-status">
          <Text variant="smallStrong" accessibilityLiveRegion="polite">{status.confirmed ? "Submitted · Participation confirmed. Your club can use this availability for staffing." : status.declined ? "Declined participation. You are excluded from confirmed staffing counts." : "Not submitted for this round. Saved edits are excluded from confirmed staffing counts until you submit."}</Text>
          {readOnly ? null : (
            <View style={{ gap: 8 }}>
              <Button full testID="availability-submit-round" label={status.confirmed ? "Update submitted availability" : "Submit round availability"} loading={working} disabled={!!autosave.recovery} onPress={submitRound} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button size="compact" variant="secondary" testID="availability-use-global" label="Use current global schedule" disabled={locked} onPress={useGlobal} />
                <Button size="compact" variant="secondary" testID="availability-withdraw" label="Withdraw confirmation" disabled={locked || !status.confirmed} onPress={withdraw} />
                <Button size="compact" variant="ghost" testID="availability-decline" label="Decline participation" disabled={locked || status.declined} onPress={decline} />
                {unsubmitted ? <Button size="compact" variant="secondary" testID="availability-declare-none" label="Declare no availability" disabled={locked} onPress={() => change({ ...schedule, weeklySubmitted: true })} /> : null}
              </View>
            </View>
          )}
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        {recurring ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <IconButton icon={ChevronLeft} label="Previous week" testID="availability-previous-week" onPress={() => setWeek(addDays(week, -7))} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text variant="bodyStrong" testID="availability-week">Week of {formatDateKey(week, { month: "short", day: "numeric", year: "numeric" })}</Text>
              {week !== monday(today()) ? <Press onPress={() => setWeek(monday(today()))} accessibilityLabel="Go to this week" style={{ minHeight: 28, justifyContent: "center" }}><Text variant="caption" color={colors.brandInk}>This week</Text></Press> : null}
            </View>
            <IconButton icon={ChevronRight} label="Next week" testID="availability-next-week" onPress={() => setWeek(addDays(week, 7))} />
          </View>
        )}
        <View accessibilityRole="tablist" accessibilityLabel="Day to edit" style={{ flexDirection: "row", gap: 4 }}>
          {WEEK_DAYS.map((name, i) => {
            const selected = i === day, hours = visibleHours(days[i]);
            return (
              <Press key={name} testID={`availability-day-${i}`} accessibilityRole="tab" accessibilityState={{ selected }}
                accessibilityLabel={`${name}${recurring ? "" : `, ${dateLabel(i)}`}. ${knownDays[i] ? `${hours} hours available` : "Not submitted"}`}
                onPress={() => { if (!selected) { haptics.tick(); setDay(i); } }}
                style={{ flex: 1, minHeight: TARGET + 10, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4, backgroundColor: selected ? colors.primary : colors.muted }}>
                <Text variant="smallStrong" color={selected ? colors.primaryForeground : colors.foreground}>{name.slice(0, 3)}</Text>
                {recurring ? null : <Text variant="caption" color={selected ? colors.primaryForeground : colors.mutedForeground}>{dates[i].slice(8).replace(/^0/, "")}</Text>}
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: hours ? (selected ? colors.primaryForeground : colors.primary) : "transparent" }} />
              </Press>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Legend color={colors.primary} label="Available" />
          <Legend color={colors.card} border={colors.border} label="Unavailable" />
          <Legend color={colors.muted} border={colors.border} dashed label="Not submitted" />
        </View>
        <Text variant="caption">{knownDays[day] ? `${dayName}${recurring ? "s" : `, ${dateLabel(day)}`}: ${visibleHours(days[day])} hours available.` : `${dayName}${recurring ? "s are" : " is"} not submitted yet. Times you add submit it.`} Tap a time to add or remove it, or touch and hold, then drag to fill a range.{recurring ? "" : " Date changes replace the editable hours on that day."}</Text>
        <DayGrid cells={days[day]} known={knownDays[day]} dayName={dayName} readOnly={locked} onPaintingChange={onPaintingChange} onChange={cells => editDays(days.map((value, i) => i === day ? cells : value), [day])} />
        {readOnly ? null : (
          <>
            <Divider />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button size="compact" variant="secondary" icon={Copy} testID="availability-copy-day" label={`Copy ${dayName.slice(0, 3)} to…`} disabled={locked} onPress={() => setCopying(true)} />
              <Button size="compact" variant="secondary" testID="availability-clear-day" label={`Clear ${dayName.slice(0, 3)}`} disabled={locked} onPress={() => clear([day])} />
              <Button size="compact" variant="secondary" testID="availability-clear-week" label="Clear entire week" disabled={locked} onPress={() => clear([0, 1, 2, 3, 4, 5, 6])} />
              {recurring ? null : <Button size="compact" variant="secondary" testID="availability-copy-previous" label="Copy previous week" disabled={locked} onPress={copyPrevious} />}
              {hasDateChange ? <Button size="compact" variant="ghost" testID="availability-use-recurring" label={`Use recurring on ${dayName.slice(0, 3)}`} disabled={locked} onPress={() => change(restoreVisibleRecurring(schedule, dates[day]))} /> : null}
            </View>
            {!schedule.weeklySubmitted && !scope ? <Button full variant="secondary" testID="availability-submit-week" label="Submit this recurring week (even if empty)" disabled={locked} onPress={() => change({ ...schedule, weeklySubmitted: true })} /> : null}
          </>
        )}
        {notice ? <Text testID="availability-notice" variant="small" accessibilityLiveRegion="polite">{notice}</Text> : null}
      </Card>
      <CopySheet open={copying} source={day} onClose={() => setCopying(false)} onCopy={targets => { setCopying(false); copyTo(targets); }} />
    </View>
  );
}

function Legend({ color, border, dashed, label }: { color: string; border?: string; dashed?: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: border, borderStyle: dashed ? "dashed" : "solid" }} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function CopySheet({ open, source, onClose, onCopy }: { open: boolean; source: number; onClose: () => void; onCopy: (targets: number[]) => void }) {
  const { colors } = useTheme();
  const [targets, setTargets] = useState<number[]>([]);
  const close = () => { setTargets([]); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={`Copy ${WEEK_DAYS[source]} to`} testID="availability-copy-sheet">
      <View style={{ gap: 4 }}>
        {WEEK_DAYS.map((name, i) => i === source ? null : (
          <Press key={name} testID={`availability-copy-to-${i}`} accessibilityRole="checkbox" accessibilityState={{ checked: targets.includes(i) }} accessibilityLabel={name}
            onPress={() => { haptics.tick(); setTargets(value => value.includes(i) ? value.filter(item => item !== i) : [...value, i]); }}
            style={{ minHeight: TARGET + 4, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: targets.includes(i) ? colors.primary : colors.border, backgroundColor: targets.includes(i) ? colors.primary : "transparent" }} />
            <Text variant="body">{name}</Text>
          </Press>
        ))}
        <Button full size="large" testID="availability-copy-confirm" style={{ marginTop: 8 }} label={targets.length ? `Copy to ${targets.length} ${targets.length === 1 ? "day" : "days"}` : "Choose days"} disabled={!targets.length}
          onPress={() => { const chosen = targets; setTargets([]); onCopy(chosen); }} />
      </View>
    </Sheet>
  );
}

