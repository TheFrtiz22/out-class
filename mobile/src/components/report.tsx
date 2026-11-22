import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Check, Flag } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Press, TARGET } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";
import type { Membership } from "~/lib/types";

/** The targets the app reports, as the web's reportInputSchema names them (lib/content-reports.ts). */
export type ReportTarget = { type: "club"; id: string } | { type: "event"; id: string } | { type: "event-flyer"; eventId: string } | { type: "announcement"; id: string };
/** The web's reasons and labels (lib/content-reports.ts `REPORT_REASONS`, `reportReasonLabels`); the server checks them. */
export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "COPYRIGHT", label: "Copyright infringement" },
  { value: "OTHER", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
const INTRO = "Reports go to the OutClass team. We don’t tell the person or club who reported them.";
const FAILED = "We couldn’t send your report. Please try again.";

/**
 * Whether the account runs this club (owner or any club permission), so its own content offers no Report, as on the
 * web (components/reports/report-content-button.tsx). The server refuses a report of one's own content either way.
 */
export function ownsClub(memberships: Pick<Membership, "clubId" | "status" | "alumniSince" | "isOwner" | "permissions">[] | undefined, clubId: string) {
  return !!memberships?.some(item => item.clubId === clubId && item.status === "ACTIVE" && !item.alumniSince && (item.isOwner || (item.permissions?.length ?? 0) > 0));
}

/**
 * Report user-generated content to the OutClass team (App Store 1.2): pick a reason, send `content.report`,
 * and see the server's confirmation or refusal. Used inside a sheet the caller already shows (the Inbox) or
 * through ReportButton's own sheet.
 */
export function ReportForm({ target, onDone }: { target: ReportTarget; onDone: () => void }) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const send = useMutation({
    mutationFn: (chosen: ReportReason) => api.post<{ message: string }>("content.report", { target, reason: chosen }),
    onSuccess: () => haptics.confirm(),
    onError: () => haptics.error(),
  });
  if (send.isSuccess) return (
    <View style={{ gap: 14 }} testID="report-done">
      <View accessible accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Check size={18} color={colors.success} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>{send.data?.message || "Thanks. Our team will review this."}</Text>
      </View>
      <Button full size="large" testID="report-close" label="Done" onPress={onDone} />
    </View>
  );
  return (
    <View style={{ gap: 12 }} testID="report-form">
      <Text variant="small">{INTRO}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Reason">
        {REPORT_REASONS.map((option, index) => {
          const selected = reason === option.value;
          return (
            <Press key={option.value} testID={`report-reason-${option.value.toLowerCase()}`} accessibilityRole="radio" accessibilityState={{ selected, disabled: send.isPending }} accessibilityLabel={option.label}
              disabled={send.isPending} onPress={() => { haptics.tick(); send.reset(); setReason(option.value); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 4, paddingVertical: 8, borderTopWidth: index ? 0.5 : 0, borderTopColor: colors.border }}>
              <Text variant={selected ? "bodyStrong" : "body"} style={{ flex: 1 }}>{option.label}</Text>
              <View style={{ width: 20, alignItems: "center" }}>{selected ? <Check size={18} color={colors.brandInk} /> : null}</View>
            </Press>
          );
        })}
      </View>
      {send.isError ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="report-error">{errorMessage(send.error, FAILED)}</Text> : null}
      <Button full size="large" testID="report-submit" label={send.isPending ? "Sending…" : "Submit report"} loading={send.isPending} disabled={!reason || send.isPending} onPress={() => { if (reason) send.mutate(reason); }} />
      <Button full variant="ghost" testID="report-cancel" label="Cancel" disabled={send.isPending} onPress={onDone} />
    </View>
  );
}

/** A low-emphasis "Report" that opens ReportForm in its own sheet. `label` names the content for the sheet and screen readers. */
export function ReportButton({ target, label, text = "Report", testID }: { target: ReportTarget; label: string; text?: string; testID?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  // A fresh form each time it opens, so a finished report never shows again on the next open.
  const [round, setRound] = useState(0);
  return (
    <>
      <Press testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setRound(value => value + 1); setOpen(true); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET, alignSelf: "center", paddingHorizontal: 8 }}>
        <Flag size={14} color={colors.mutedForeground} />
        <Text variant="small" color={colors.mutedForeground}>{text}</Text>
      </Press>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} testID={testID ? `${testID}-sheet` : undefined}>
        <ReportForm key={round} target={target} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
