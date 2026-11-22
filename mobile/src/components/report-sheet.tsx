import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { ChoiceChips } from "~/components/choice-chips";
import { Field } from "~/components/field";
import { Flag } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, IconButton } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

/** What can be reported: the web's report targets (lib/content-reports.ts `reportTargetSchema`). */
export type ReportTarget = { type: "club"; id: string } | { type: "event"; id: string } | { type: "event-flyer"; eventId: string } | { type: "announcement"; id: string };
type Reason = "SPAM" | "HARASSMENT" | "INAPPROPRIATE" | "IMPERSONATION" | "COPYRIGHT" | "OTHER";
// Same labels as the web's `reportReasonLabels`.
const reasons: { value: Reason; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "COPYRIGHT", label: "Copyright infringement" },
  { value: "OTHER", label: "Something else" },
];
const DETAILS_MAX = 1000;
/** `reportContent` answers refusals as data, not as an HTTP error. */
type ReportResult = { ok: true; message: string; dmcaHref?: string } | { ok: false; error: string };

/**
 * Report objectionable content to the OutClass team (App Store guideline 1.2). The server checks
 * the person can see the target, refuses their own club's content, dedupes and rate-limits, and
 * never tells the club who reported it.
 */
export function ReportSheet({ open, onClose, target, subject }: { open: boolean; onClose: () => void; target: ReportTarget; subject: string }) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; dmcaHref?: string } | null>(null);
  const send = useMutation({
    mutationFn: () => api.post<ReportResult>("reports.content", { target, reason, details: details.trim() }),
    onSuccess: result => {
      if (result.ok) { haptics.confirm(); setDone({ message: result.message, dmcaHref: result.dmcaHref }); }
      else { haptics.error(); setError(result.error); }
    },
    onError: reason => { haptics.error(); setError(errorMessage(reason, "Could not send your report. Try again.")); },
  });
  function close() {
    onClose();
    setReason(null); setDetails(""); setError(null); setDone(null);
  }
  return (
    <Sheet open={open} onClose={close} title={`Report ${subject}`} testID="report-sheet">
      {done ? (
        <View style={{ gap: 14 }}>
          <Text variant="body" accessibilityRole="alert" testID="report-done">{done.message}</Text>
          {done.dmcaHref ? <Text variant="small">Copyright owners can also send a formal notice as described in our Terms.</Text> : null}
          {done.dmcaHref ? <Button variant="secondary" full label="Read the Terms" testID="report-dmca" onPress={() => { WebBrowser.openBrowserAsync(`${config.apiUrl}${done.dmcaHref}`).catch(() => {}); }} /> : null}
          <Button full label="Done" testID="report-close" onPress={close} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text variant="small">Tell the OutClass team what’s wrong. The club won’t see who reported it.</Text>
          <ChoiceChips label="Reason" testID="report-reason" options={reasons} value={reason} onChange={value => { setReason(value); setError(null); }} />
          <Field label="Details (optional)" testID="report-details" value={details} onChangeText={setDetails} multiline maxLength={DETAILS_MAX} />
          {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="report-error">{error}</Text> : null}
          <Button full label="Send report" testID="report-send" loading={send.isPending} disabled={!reason || send.isPending} onPress={() => { setError(null); send.mutate(); }} />
        </View>
      )}
    </Sheet>
  );
}

/** A header button that opens the report sheet. */
export function ReportButton({ target, subject, testID = "report-open" }: { target: ReportTarget; subject: string; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={Flag} label={`Report ${subject}`} testID={testID} onPress={() => setOpen(true)} />
      <ReportSheet open={open} onClose={() => setOpen(false)} target={target} subject={subject} />
    </>
  );
}
