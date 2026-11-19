import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { ArrowRight, CalendarDays, ChevronDown, ChevronUp, FileText } from "~/components/icons";
import { openPrivateDocument } from "~/components/private-image";
import { Text } from "~/components/text";
import { Button, Card, Chip, ClubMark, Divider, Press, TARGET, statusTone } from "~/components/ui";
import { useTheme } from "~/lib/theme";
import type { StudentApplication } from "~/lib/types";
import { OfferCard } from "./offer-card";
import { StatusProgress } from "./status-progress";

/** Club mark, eyebrow, name and a line of detail: the heading of an application screen. */
export function ApplicationHeading({ application: app, eyebrow, children }: { application: StudentApplication; eyebrow: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <ClubMark name={app.club.name} color={app.club.color} logoUrl={app.club.logoUrl} size={48} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="eyebrow">{eyebrow}</Text>
        <Text variant="title" accessibilityRole="header">{app.club.name}</Text>
        {children}
      </View>
    </View>
  );
}

/**
 * A submitted application (web: ApplicationStatusDetail, and the read-only responses view of
 * ApplicationTrackerView): current status and round, decision and offer, the interview for this
 * round, recorded interviews, and the submitted answers.
 */
export function StatusDetail({ application: app, notice, alumniRespond }: { application: StudentApplication; notice: string; alumniRespond: string | null }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const [responses, setResponses] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const letter = app.decisionLetters.length > 0;
  const booked = !!app.interview && !app.interview.past;

  if (responses) return (
    <>
      <ApplicationHeading application={app} eyebrow="Your application">
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Chip label={app.statusLabel} tone={statusTone(app.statusCode)} />
          <Text variant="caption" style={{ flexShrink: 1 }}>{app.submittedLabel ? `Submitted ${app.submittedLabel}` : "Submitted application"}</Text>
        </View>
      </ApplicationHeading>
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 14, gap: 10 }}>
        <Text variant="small">Your responses are saved and read-only after submission.</Text>
        <Button testID="application-view-status" variant="secondary" label="View status" onPress={() => setResponses(false)} />
      </View>
      <Text variant="section" accessibilityRole="header">Your submitted responses</Text>
      {app.club.questions.map((question, index) => {
        const response = app.answers.find(answer => answer.questionId === question.id)?.response;
        const attachment = question.type === "FILE_UPLOAD" && response ? app.attachments[question.id] : undefined;
        const shown = question.type === "MULTI_SELECT" && response ? (() => { try { const value: unknown = JSON.parse(response); return Array.isArray(value) ? value.join(", ") : response; } catch { return response; } })() : response;
        return (
          <View key={question.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 6 }}>
            <Text variant="caption">Question {index + 1}</Text>
            <Text variant="card">{question.prompt}</Text>
            {attachment && /^https?:\/\//i.test(attachment) ? (
              <Press onPress={() => { void Linking.openURL(attachment).catch(() => {}); }} accessibilityRole="link" accessibilityLabel="Open submitted document" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
                <Text variant="small" color={colors.foreground} style={{ textDecorationLine: "underline" }}>Open submitted document</Text>
              </Press>
            ) : attachment ? (
              // An uploaded PDF: the saved answer's own file through the media route; the server decides who may read it.
              <Press testID={`application-attachment-${index + 1}`} onPress={() => { void openPrivateDocument("application-attachments", { applicationId: app.id, questionId: question.id }); }} accessibilityRole="link" accessibilityLabel="Open submitted document" style={{ minHeight: TARGET, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
                <FileText size={16} color={colors.mutedForeground} />
                <Text variant="small" color={colors.foreground} style={{ textDecorationLine: "underline" }}>Open submitted document</Text>
              </Press>
            ) : <Text variant="small" selectable style={{ lineHeight: 24 }}>{shown || "No response provided."}</Text>}
          </View>
        );
      })}
      {!app.club.questions.length ? <Text variant="small">No club-specific questions.</Text> : null}
    </>
  );

  return (
    <>
      <ApplicationHeading application={app} eyebrow={app.decision ? "Decision received" : "Application progress"}>
        {app.submittedLabel ? <Text variant="caption">Submitted {app.submittedLabel}</Text> : null}
      </ApplicationHeading>
      {notice ? <Text variant="small" accessibilityRole="alert" testID="application-notice">{notice}</Text> : null}

      <Card accessibilityLabel="Current application status" testID="application-status" style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <Text variant="section" accessibilityRole="header">{app.statusLabel}</Text>
          <Chip label={app.statusLabel} tone={statusTone(app.statusCode)} />
        </View>
        {!app.decision && app.round?.name ? <Text variant="small">Current club round · {app.round.name}</Text> : null}
        <Text variant="small" style={{ lineHeight: 22 }}>{app.nextStep}</Text>
        {letter ? <Button testID="application-view-decision" label="View Decision" onPress={() => router.push({ pathname: "/decision/[applicationId]", params: { applicationId: app.id } })} /> : null}
        {!letter && app.decision ? <Text variant="caption">Formal letter unavailable for this historical decision.</Text> : null}
        {!letter && (app.status === "ACCEPTED" || app.recruitmentOffer) ? <OfferCard application={app} alumniMessage={alumniRespond} /> : null}
        {app.status === "WAITLISTED" && !letter ? <Text variant="small">No decision date has been provided on OutClass.</Text> : null}
        <View style={{ marginTop: 6 }}><StatusProgress application={app} /></View>
      </Card>

      {app.status === "INTERVIEWING" ? (
        <View accessibilityLabel="Interview scheduling" style={{ gap: 10 }}>
          <Text variant="section" accessibilityRole="header">{booked ? "Your interview" : "Book your interview"}</Text>
          <Card testID="application-interview" style={{ gap: 10 }}>
            {booked ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CalendarDays size={16} color={colors.interview} />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>Interview · {app.interview!.label}</Text>
                </View>
                <Text variant="small">{app.interview!.location || "Location not provided"}</Text>
              </>
            ) : app.interview?.past ? <Text variant="small">Interview · {app.interview.label}. Check the club’s instructions for next steps.</Text>
              : <Text variant="small">You haven’t booked an interview for this round. Check available times and the club’s instructions.</Text>}
            <Button testID="application-open-interview" variant={app.attention ? "primary" : "secondary"} icon={ArrowRight} label={booked || app.interview?.past ? "Review interview" : "Book your interview"} onPress={() => router.push({ pathname: "/interview/[applicationId]", params: { applicationId: app.id } })} />
          </Card>
        </View>
      ) : null}

      {app.history.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 }}>
          <Press onPress={() => setHistoryOpen(open => !open)} accessibilityLabel={`Recorded interviews, ${app.history.length}`} accessibilityState={{ expanded: historyOpen }} style={{ minHeight: TARGET + 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text variant="smallStrong" style={{ flex: 1 }}>Recorded interviews · {app.history.length}</Text>
            {historyOpen ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
          </Press>
          {historyOpen ? app.history.map(booking => (
            <View key={booking.id}>
              <Divider />
              <View style={{ flexDirection: "row", gap: 10, paddingVertical: 12 }}>
                <View style={{ marginTop: 3 }}><CalendarDays size={16} color={colors.mutedForeground} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="small" color={colors.foreground}>{booking.startLabel}</Text>
                  <Text variant="caption">Ends {booking.endLabel} · {booking.location || "Location not provided"}</Text>
                </View>
              </View>
            </View>
          )) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
        <Button testID="application-view-responses" variant="secondary" label="View submitted responses" onPress={() => setResponses(true)} />
        <Button variant="ghost" icon={CalendarDays} label="Open calendar" onPress={() => router.push("/calendar")} />
      </View>
    </>
  );
}
