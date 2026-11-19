import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { View } from "react-native";
import { OWN_APPLICATION_MESSAGE, POLL_MS, type RoomSnapshot } from "~/components/voting/room";
import { PrivateImage, photoParams } from "~/components/private-image";
import { Text } from "~/components/text";
import { Button, Card, Divider, Skeleton } from "~/components/ui";
import { api } from "~/lib/api";
import { fonts, useTheme } from "~/lib/theme";

/** components/live-voting/slide-model.ts: what one applicant's slide shows, from the server-projected presentation only. */
type SlideFact = { field: string; label: string; value: string; unit?: string; meta: string[] };
type SlideParagraph = { text: string; quote?: boolean; meta?: string; muted?: boolean };
type SlideNote = { key: string; label: string; paragraphs: SlideParagraph[] };
type Slide = { name: string; anonymous: boolean; photo: string | null; showPhoto: boolean; profile: { field: string; text: string; accent?: boolean }[]; facts: SlideFact[]; notes: SlideNote[] };
type Presentation = { slide: Slide } | { stale: true } | { ownApplication: true };

const initials = (name: string) => name.split(/\s+/).filter(word => /^[A-Za-z]/.test(word)).slice(0, 2).map(word => word[0]!.toUpperCase()).join("");

/**
 * The applicant on screen. One authorized read per applicant (re-read every 5 s while live, as the
 * web's slide does); the fields are exactly the ones the session exposes to this viewer. A viewer's
 * own application arrives as a bare marker with no applicant data, and shows only that message.
 */
export function ApplicantSlide({ room, applicationId, position, live, result, onStale }: { room: RoomSnapshot; applicationId: string; position?: string; live: boolean; result?: string | null; onStale: () => void }) {
  const { colors, radius } = useTheme();
  // Keyed by the viewer's access version too, so a slide read under earlier permissions is never reused.
  const query = useQuery<Presentation, Error>({
    queryKey: ["leader", "voting.presentation", room.clubId, room.id, applicationId, room.accessVersion],
    queryFn: ({ signal }) => api.get<Presentation>("voting.presentation", { clubId: room.clubId, sessionId: room.id, applicationId }, { signal }),
    staleTime: 0, gcTime: 60_000, refetchInterval: live ? POLL_MS : false,
  });
  const data = query.data;
  const stale = !!data && "stale" in data;
  // The room moved on before this viewer's snapshot did: fetch the current room rather than show an error.
  useEffect(() => { if (stale) onStale(); }, [stale, onStale]);

  if (query.isError && !data) {
    return (
      <Card accessibilityRole="alert" style={{ gap: 10 }}>
        <Text variant="body">Applicant information unavailable.</Text>
        <Button label="Retry presentation" variant="secondary" size="compact" onPress={() => query.refetch()} />
      </Card>
    );
  }
  if (!data || stale) {
    return (
      <Card accessibilityLabel="Loading applicant presentation…" accessibilityRole="progressbar" style={{ gap: 12 }}>
        <Skeleton width="34%" height={12} />
        <Skeleton width="70%" height={30} />
        <Skeleton width="52%" />
        <Skeleton width="100%" height={48} />
      </Card>
    );
  }
  if ("ownApplication" in data) {
    return <Card tone="soft" testID="voting-own-application"><Text variant="body" accessibilityRole="text">{OWN_APPLICATION_MESSAGE}</Text></Card>;
  }
  if (!("slide" in data)) return null;
  const slide = data.slide;
  return (
    <Card testID="voting-applicant" accessibilityLabel="Current applicant presentation" style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {slide.showPhoto ? (
          // The slide's photo address is the server's, scoped to this session; kept in memory only. Initials stand in without one.
          <View accessible={false} style={{ width: 56, height: 56, borderRadius: radius.full, overflow: "hidden", backgroundColor: colors.brandSubtle, alignItems: "center", justifyContent: "center" }}>
            <PrivateImage kind="profile-photos" params={slide.anonymous ? null : photoParams(slide.photo)} style={{ width: 56, height: 56 }}
              fallback={<Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.displayStrong, fontSize: 20, lineHeight: 26, color: colors.brandInk }}>{slide.anonymous ? "" : initials(slide.name)}</Text>} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          {position ? <Text variant="eyebrow">{position}</Text> : null}
          <Text variant="display" accessibilityRole="header" testID="voting-applicant-name" style={{ fontSize: 28, lineHeight: 34 }}>{slide.name}</Text>
          {result ? <Text variant="smallStrong" color={colors.brandInk}>{result}</Text> : null}
        </View>
      </View>
      {slide.profile.length ? (
        <View style={{ gap: 2 }}>
          {slide.profile.map((line, index) => <Text key={`${line.field}:${index}`} variant={line.accent ? "smallStrong" : "body"} color={line.accent ? colors.brandInk : undefined}>{line.text}</Text>)}
        </View>
      ) : null}
      {slide.facts.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {slide.facts.map(fact => (
            <View key={fact.field} style={{ flexGrow: 1, minWidth: "44%", backgroundColor: colors.contentSoft, borderRadius: radius.md, padding: 12, gap: 2 }}>
              <Text variant="caption">{fact.label}</Text>
              <Text variant="metric" style={{ fontFamily: fonts.sansSemibold, fontSize: 24, lineHeight: 30 }}>{fact.value}{fact.unit ? <Text variant="small"> {fact.unit}</Text> : null}</Text>
              {fact.meta.map(line => <Text key={line} variant="caption">{line}</Text>)}
            </View>
          ))}
        </View>
      ) : null}
      {slide.notes.map(note => (
        <View key={note.key} style={{ gap: 6 }}>
          <Divider />
          <Text variant="smallStrong" accessibilityRole="header">{note.label}</Text>
          {note.paragraphs.map((paragraph, index) => (
            <View key={index} style={{ gap: 2 }}>
              <Text variant="body" color={paragraph.muted ? colors.mutedForeground : undefined}>{paragraph.quote ? `“${paragraph.text}”` : paragraph.text}</Text>
              {paragraph.meta ? <Text variant="caption">{paragraph.meta}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}
