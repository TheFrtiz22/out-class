import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { addToCalendar } from "~/components/applications/calendar";
import { ZONE_LABEL, dayKey, formatDay, schedulingDateTime, shortDay, slotTime } from "~/components/applications/format";
import { Header, useHeaderInset } from "~/components/header";
import { CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin } from "~/components/icons";
import { useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, ErrorState, IconButton, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { ApplicantSchedule, ApplicationsView, InterviewRoom, InterviewSlot } from "~/lib/types";

type Choice = InterviewSlot & { room: InterviewRoom };
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Interview booking (web: components/interviews/applicant-booking.tsx and booking-picker.tsx):
 * the round's open times by Eastern day, reserve, reschedule where the round allows it, cancel.
 * The server decides what is bookable; its refusal is shown and the times are re-read.
 */
export default function InterviewScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const router = useRouter();
  const top = useHeaderInset();
  const { colors, radius } = useTheme();
  const queryClient = useQueryClient();
  const { confirm, sheet } = useConfirm();
  const schedule = useApiQuery<ApplicantSchedule>("interviews.schedule", { applicationId }, { staleTime: 0 });
  // Alumni accounts are read-only: a booked time shows, with no booking, moving or cancelling.
  const applications = useApiQuery<ApplicationsView>("applications.view");
  const alumni = !!applications.data?.alumni;
  const [roomId, setRoomId] = useState("all");
  const [day, setDay] = useState("");
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [calendarNote, setCalendarNote] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const saving = useRef(false);

  const data = schedule.data;
  const booking = data?.booking ?? null;
  const now = Date.now();
  const booked = !!booking && +new Date(booking.endTime) > now;
  const bookingPast = !!booking && +new Date(booking.endTime) <= now;
  const rooms = alumni ? [] : data?.rooms ?? [];
  const allowRescheduling = alumni ? false : data?.allowRescheduling !== false;
  const publicationState = data?.publicationState ?? "PUBLISHED";
  const canCancel = !alumni && !!booking && data?.allowCancellation !== false;
  const openRooms = rooms.filter(room => room.isOpen);
  const oneRoom = openRooms.length <= 1;
  const slots: Choice[] = openRooms.filter(room => roomId === "all" || room.id === roomId)
    .flatMap(room => room.slots.filter(slot => +new Date(slot.startTime) > now).map(slot => ({ ...slot, room })))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const availableDates = [...new Set(slots.filter(slot => slot.booked < slot.capacity || slot.id === booking?.slotId).map(slot => dayKey(slot.startTime)))];
  const firstStart = rooms.flatMap(room => room.slots).map(slot => slot.startTime).sort()[0];
  const month = chosenMonth ?? dayKey(firstStart ?? new Date()).slice(0, 7);
  const selectedDay = availableDates.includes(day) && day.startsWith(month) ? day : availableDates.find(date => date.startsWith(month)) ?? "";
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const stepMonth = (step: number) => { const next = new Date(Date.UTC(year, monthNumber - 1 + step, 1)); setChosenMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`); };
  const reserveBlocked = publicationState !== "PUBLISHED" || (!!booking && !allowRescheduling);

  const refresh = async () => {
    await schedule.refetch();
    void queryClient.invalidateQueries({ queryKey: ["applications.view"] });
    void queryClient.invalidateQueries({ queryKey: ["home.view"] });
    void queryClient.invalidateQueries({ queryKey: ["calendar.view"] });
  };

  async function run(action: () => Promise<unknown>, success: string) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); setNotice(""); setCalendarNote("");
    try {
      await action();
      haptics.confirm();
      setNotice(success);
    } catch (cause) {
      haptics.error();
      setError(errorMessage(cause, "Could not confirm your booking update. Check your reservation and available times, or reload and retry."));
    } finally {
      // Saved or refused, the times on screen are re-read from the server.
      await refresh().catch(() => {});
      saving.current = false; setBusy(false);
    }
  }

  async function choose(slot: Choice) {
    if (busy || reserveBlocked || slot.id === booking?.slotId) return;
    const label = booking ? "Confirm new time" : "Confirm interview";
    const confirmed = await confirm({ title: label, description: `${shortDay(slot.startTime)} · ${slotTime(slot.startTime)} – ${slotTime(slot.endTime)}\n${ZONE_LABEL}\n${slot.room.location}`, confirmLabel: label });
    if (!confirmed) return;
    await run(() => api.post("interviews.reserve", { applicationId, slotId: slot.id }), `Interview ${booking ? "rescheduled" : "confirmed"} for ${schedulingDateTime(slot.startTime)} at ${slot.room.location}.`);
  }

  async function cancel() {
    if (!booking || busy) return;
    const confirmed = await confirm({ title: "Release your reserved time?", confirmLabel: "Yes, cancel", cancelLabel: "Keep interview", destructive: true });
    if (!confirmed) return;
    await run(() => api.post("interviews.cancel", { bookingId: booking.id }), "Booking cancelled. Your reserved time has been released.");
  }

  async function calendar() {
    if (!booking || !data) return;
    setCalendarNote("");
    const result = await addToCalendar({ title: `${data.clubName} interview`, startTime: booking.startTime, endTime: booking.endTime, location: booking.location, notes: data.roundName });
    if (result === "added") { haptics.save(); setAdded(booking.id + booking.slotId); setCalendarNote("Added to your calendar."); }
    else setCalendarNote(result === "denied" ? "Calendar access is off for OutClass. You can allow it in Settings." : "This couldn’t be added to your calendar.");
  }

  const durations = [...new Set(rooms.map(room => room.duration))].join(" / ") || (booking ? String((+new Date(booking.endTime) - +new Date(booking.startTime)) / 60000) : "");

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="interview-screen" refreshing={schedule.isRefetching && !busy} onRefresh={() => { void schedule.refetch(); }}>
        <Text variant="display" accessibilityRole="header">{booked ? "Your interview" : "Book your interview"}</Text>
        {schedule.isPending ? (
          <View accessibilityLabel="Loading interview times…" accessibilityRole="progressbar" style={{ gap: 16 }}>
            <Card style={{ gap: 10 }}><Skeleton width="40%" height={12} /><Skeleton width="70%" height={22} /><Skeleton width="90%" /></Card>
            <Skeleton height={300} radius={12} />
          </View>
        ) : schedule.isError && !data ? (
          <ErrorState message={errorMessage(schedule.error, "Could not load interview times.")} offline={schedule.error instanceof ApiError && schedule.error.offline} onRetry={() => { void schedule.refetch(); }} />
        ) : data ? (
          <>
            {data.conflictingTimes ? <Text variant="small" testID="booking-conflicts">{data.conflictingTimes} time{data.conflictingTimes === 1 ? " is" : "s are"} hidden because {data.conflictingTimes === 1 ? "it overlaps" : "they overlap"} another interview you’ve booked.</Text> : null}
            {alumni ? <Text variant="small">{applications.data!.alumniRefusals.book}</Text> : null}

            <Card tone="soft" style={{ gap: 8 }}>
              <Text variant="eyebrow">{data.clubName}</Text>
              <Text variant="section" accessibilityRole="header">{data.roundName || "Your interview"}</Text>
              <Text variant="small" style={{ lineHeight: 21 }}>{booking ? bookingPast ? "Your recorded interview details are below." : allowRescheduling ? "Your time is reserved. You can reschedule before the interview starts." : "Your time is reserved. Contact the club if you need a different time." : "Choose a day, select a time, then confirm your interview."}</Text>
              {rooms.length > 0 || booking ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Clock3 size={16} color={colors.mutedForeground} /><Text variant="small" color={colors.foreground}>{durations} minute interviews</Text></View> : null}
              {rooms.length > 0 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><MapPin size={16} color={colors.mutedForeground} /><Text variant="small" color={colors.foreground} style={{ flex: 1 }}>{rooms.length === 1 ? rooms[0]!.name : `${rooms.length} rooms available`}</Text></View> : null}
              <Text variant="caption" color={colors.foreground} style={{ marginTop: 4 }}>{ZONE_LABEL}</Text>
            </Card>

            {notice ? <Text variant="small" color={colors.foreground} accessibilityRole="alert" testID="interview-notice">{notice}</Text> : null}
            {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="interview-error">{error}</Text> : null}

            {booking ? (
              <View testID="interview-booking" style={{ backgroundColor: colors.successSubtle, borderRadius: radius.lg, padding: 16, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={20} color={colors.success} />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{bookingPast ? "Recorded interview" : "Interview confirmed"}</Text>
                </View>
                <Text variant="body">{schedulingDateTime(booking.startTime)}</Text>
                <Text variant="small" color={colors.foreground} selectable>{booking.location}</Text>
                {+new Date(booking.startTime) > now ? (
                  <>
                    {allowRescheduling ? <Text variant="caption" color={colors.foreground} style={{ marginTop: 4 }}>Choose another time below to reschedule.</Text> : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      <Button testID="interview-add-calendar" variant="secondary" size="compact" icon={CalendarPlus} label={added === booking.id + booking.slotId ? "Added to Calendar" : "Add to Calendar"} disabled={added === booking.id + booking.slotId} onPress={() => void calendar()} />
                      {canCancel ? <Button testID="interview-cancel" variant="ghost" size="compact" label="Cancel interview" disabled={busy} onPress={() => void cancel()} /> : null}
                    </View>
                    {calendarNote ? <Text variant="caption" color={colors.foreground} accessibilityRole="alert" testID="interview-calendar-note">{calendarNote}</Text> : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {publicationState !== "PUBLISHED" ? (
              <Card><Text variant="small" color={colors.foreground}>{publicationState === "PAUSED" ? "The club has paused new interview times. Your interview is still booked." : "Interview times aren’t open yet. Check back later or contact the club."}</Text></Card>
            ) : !alumni && !slots.some(slot => slot.booked < slot.capacity) && !booking ? (
              <Card tone="soft" style={{ gap: 6 }}>
                <Text variant="small" color={colors.foreground} style={{ lineHeight: 21 }}>No interview times are available right now. Your invitation is still recorded; check again later or contact the club.</Text>
                <Press onPress={() => router.back()} accessibilityRole="link" accessibilityLabel="Back to application status" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
                  <Text variant="small" color={colors.foreground} style={{ textDecorationLine: "underline" }}>Back to application status</Text>
                </Press>
              </Card>
            ) : null}
            {booking && !allowRescheduling && !alumni ? <Text variant="small" color={colors.foreground}>This club requires you to contact them to reschedule.</Text> : null}

            {openRooms.length > 1 ? (
              <View style={{ gap: 8 }}>
                <Text variant="smallStrong">Location</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Location" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[{ value: "all", label: "All rooms" }, ...rooms.map(room => ({ value: room.id, label: room.name }))].map(option => {
                    const selected = option.value === roomId;
                    return (
                      <Press key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label} onPress={() => { haptics.tick(); setRoomId(option.value); setDay(""); }}
                        style={{ minHeight: TARGET - 6, paddingHorizontal: 14, justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }}>
                        <Text variant="smallStrong" color={selected ? colors.primaryForeground : colors.foreground}>{option.label}</Text>
                      </Press>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {slots.length > 0 || (booking && !alumni) ? (
              <>
                <Card accessibilityLabel="Choose interview date" style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text variant="card" accessibilityRole="header" accessibilityLiveRegion="polite">{formatDay(`${month}-01`, { month: "long", year: "numeric" })}</Text>
                    <View style={{ flexDirection: "row" }}>
                      <IconButton icon={ChevronLeft} label="Previous month" testID="interview-month-previous" onPress={() => stepMonth(-1)} />
                      <IconButton icon={ChevronRight} label="Next month" testID="interview-month-next" onPress={() => stepMonth(1)} />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {WEEKDAYS.map(weekday => <View key={weekday} style={{ width: `${100 / 7}%`, alignItems: "center", paddingBottom: 4 }}><Text variant="caption">{weekday}</Text></View>)}
                    {Array.from({ length: leading }, (_, index) => <View key={`pad-${index}`} style={{ width: `${100 / 7}%` }} />)}
                    {Array.from({ length: days }, (_, index) => {
                      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
                      const available = availableDates.includes(date), selected = date === selectedDay;
                      return (
                        <View key={date} style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 1 }}>
                          <Press testID={available ? "interview-day" : undefined} disabled={!available || busy} accessibilityLabel={formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} accessibilityState={{ selected, disabled: !available || busy }} onPress={() => { haptics.tick(); setDay(date); }}
                            style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.primary : available ? colors.brandSubtle : "transparent", opacity: available ? 1 : 0.38 }}>
                            <Text variant={available ? "smallStrong" : "small"} maxFontSizeMultiplier={1.3} color={selected ? colors.primaryForeground : available ? colors.brandInk : colors.mutedForeground}>{index + 1}</Text>
                          </Press>
                        </View>
                      );
                    })}
                  </View>
                  {!availableDates.some(date => date.startsWith(month)) ? <Text variant="caption">No available times this month. Try another month or location.</Text> : null}
                </Card>

                <View accessibilityLabel="Choose interview time" style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <CalendarDays size={18} color={colors.mutedForeground} />
                    <Text variant="card" accessibilityRole="header" accessibilityLiveRegion="polite" testID="interview-day-heading">{selectedDay ? formatDay(selectedDay, { weekday: "short", month: "short", day: "numeric" }) : "Select a date"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {slots.filter(slot => dayKey(slot.startTime) === selectedDay).map(slot => {
                      const mine = slot.id === booking?.slotId, full = slot.booked >= slot.capacity && !mine;
                      const label = [oneRoom ? "" : slot.room.name, mine ? "Your interview" : full ? "Full" : ""].filter(Boolean).join(" · ");
                      const disabled = busy || full || mine || reserveBlocked;
                      return (
                        <Press key={slot.id} testID={disabled ? undefined : "interview-slot"} disabled={disabled} onPress={() => void choose(slot)}
                          accessibilityLabel={`${slotTime(slot.startTime)}${label ? `, ${label}` : ""}`} accessibilityState={{ disabled, selected: mine }}
                          style={{ width: "31.4%", minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: mine ? colors.success : colors.border, backgroundColor: mine ? colors.successSubtle : colors.card, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 4 }}>
                          <Text variant="smallStrong">{slotTime(slot.startTime)}</Text>
                          {label ? <Text variant="caption" numberOfLines={2} align="center">{label}</Text> : null}
                        </Press>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScreenScroll>
      <Header title="Interview" back />
      {sheet}
    </View>
  );
}
