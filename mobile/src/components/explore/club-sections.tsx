import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { applicationStatusLabel, clubImage, eventDateLabel, eventScheduleLabel, eventTimeLabel, profileStatistics } from "~/components/explore/directory";
import type { IconComponent } from "~/components/icon-factory";
import { CalendarDays, Check, ChevronDown, ChevronUp, ExternalLink, Globe, Instagram, Linkedin, Mail, MapPin, Play } from "~/components/icons";
import { Text } from "~/components/text";
import { Card, ClubMark, Divider, IconButton, Press, TARGET } from "~/components/ui";
import { config } from "~/lib/config";
import { useTheme } from "~/lib/theme";
import type { PublicClub, PublicClubEvent, PublicMarketing, PublicMarketingSection } from "~/lib/types";

/** Opens a club's outbound link: web pages in the in-app browser, everything else (mailto:) by the system. */
export function openLink(url: string) {
  if (/^https?:\/\//i.test(url)) void WebBrowser.openBrowserAsync(url).catch(() => {});
  else void Linking.openURL(url).catch(() => {});
}

const sameHeading = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const marketingOf = (club: PublicClub): NonNullable<PublicMarketing> => club.marketing ?? {};

/** A page section: a Caslon heading and its content on one card (the web's `.oc-club-section`). */
export function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <View style={{ gap: 10 }} testID={testID}>
      <Text variant="section" accessibilityRole="header">{title}</Text>
      <Card style={{ gap: 12 }}>{children}</Card>
    </View>
  );
}
function Subheading({ children }: { children: ReactNode }) {
  return <Text variant="card" accessibilityRole="header">{children}</Text>;
}
function Bullets({ items }: { items: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {items.map((item, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.mutedForeground, marginTop: 10 }} />
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
function LinkRow({ label, url, icon: Icon, accessibilityLabel }: { label: string; url: string; icon?: IconComponent; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  return (
    <Press accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? label} onPress={() => openLink(url)} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: TARGET }}>
      {Icon ? <Icon size={16} color={colors.brandInk} /> : null}
      <Text variant="bodyStrong" color={colors.brandInk} style={{ flex: 1 }}>{label}</Text>
      <ExternalLink size={14} color={colors.brandInk} />
    </Press>
  );
}

/** A club-written section: its title (unless it repeats the page section's), body, and cards. */
function ProfileSection({ section, parent }: { section: PublicMarketingSection; parent: string }) {
  const titled = !sameHeading(section.title, parent) && !(parent === "Recruitment and requirements" && sameHeading(section.title, "Recruitment"));
  const { radius } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {titled ? <Subheading>{section.title}</Subheading> : null}
      {section.body ? <Text>{section.body}</Text> : null}
      {(section.cards ?? []).map((card, index) => {
        const image = clubImage(card.image, config.apiUrl);
        return (
          <Card key={index} tone="soft" style={{ gap: 6 }}>
            {image ? <Image source={{ uri: image }} accessibilityLabel={card.title || "Club highlight"} contentFit="cover" transition={150} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md }} /> : null}
            <Text variant="bodyStrong">{card.title}</Text>
            {card.description ? <Text variant="small">{card.description}</Text> : null}
            {card.url ? <LinkRow label={`Learn more about ${card.title}`} url={card.url} /> : null}
          </Card>
        );
      })}
    </View>
  );
}

function socials(m: NonNullable<PublicMarketing>) {
  return [
    { label: "Website", url: m.website, icon: Globe },
    { label: "LinkedIn", url: m.linkedin, icon: Linkedin },
    { label: "Instagram", url: m.instagram, icon: Instagram },
    { label: "Email", url: m.email ? `mailto:${m.email}` : "", icon: Mail },
  ].filter((item): item is { label: string; url: string; icon: IconComponent } => !!item.url);
}

/** Identity block (MarketingProfile): cover, logo, name, one-line description, category, club-reported figures, action, links. */
export function ClubIdentity({ club, action }: { club: PublicClub; action: ReactNode }) {
  const { colors, radius } = useTheme();
  const m = marketingOf(club);
  const banner = clubImage(club.bannerUrl, config.apiUrl);
  const stats = profileStatistics(club, m);
  const links = socials(m);
  const accent = /^#[0-9a-f]{6}$/i.test(club.color) ? club.color : colors.primary;
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <View style={{ height: 112, backgroundColor: accent }}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Defs><LinearGradient id="cover" x1="0" y1="0" x2="1" y2="0.6"><Stop offset="0" stopColor={accent} /><Stop offset="1" stopColor={colors.input} /></LinearGradient></Defs>
          <Rect width="100" height="100" fill="url(#cover)" />
        </Svg>
        {banner ? <Image source={{ uri: banner }} accessible={false} contentFit="cover" transition={150} style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ marginTop: -36, marginBottom: 12, alignSelf: "flex-start", borderRadius: radius.lg, borderWidth: 4, borderColor: colors.card, backgroundColor: colors.card }}>
          <ClubMark name={club.name} color={club.color} logoUrl={clubImage(club.logoUrl, config.apiUrl)} size={72} />
        </View>
        <Text variant="title" accessibilityRole="header" testID="club-name">{club.name}</Text>
        {club.pitch ? <Text style={{ marginTop: 6 }} color={colors.mutedForeground}>{club.pitch}</Text> : null}
        {club.category ? <Text variant="eyebrow" accessibilityLabel={`Category: ${club.category}`} style={{ marginTop: 10 }}>{club.category}</Text> : null}
        {stats.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            {stats.map((stat, index) => (
              <View key={index} accessible accessibilityLabel={`${stat.label}: ${stat.value}. ${stat.detail}`} style={{ flexGrow: 1, flexBasis: "30%", minWidth: 96, borderRadius: radius.md, backgroundColor: colors.contentSoft, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text variant="caption">{stat.label}</Text>
                <Text variant="metric" style={{ fontSize: 22, lineHeight: 28 }}>{stat.value}</Text>
                <Text variant="caption">{stat.detail}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 10 }}>
          {action}
          {links.length ? (
            <View accessibilityLabel="Club links" style={{ flexDirection: "row", gap: 2, marginLeft: -8 }}>
              {links.map(({ label, url, icon }) => <IconButton key={label} icon={icon} label={`${club.name} ${label}`} onPress={() => openLink(url)} />)}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export function UnclaimedNotice() {
  return (
    <Card tone="soft" style={{ gap: 6 }}>
      <Text variant="smallStrong">Unclaimed profile</Text>
      <Text variant="small">This organization hasn’t claimed its OutClass page yet.</Text>
    </Card>
  );
}

/** About: the description, club sections of kind "about" and outbound links. */
export function AboutSection({ club, children }: { club: PublicClub; children?: ReactNode }) {
  const m = marketingOf(club);
  const about = club.description || club.pitch;
  const sections = (m.sections ?? []).filter(section => section.visible && section.kind === "about");
  const links = [...(m.videoUrl ? [{ label: "Watch our introduction", url: m.videoUrl, video: true }] : []), ...(m.links ?? []).filter(link => link.url).map(link => ({ label: link.label || "Club website", url: link.url, video: false }))];
  if (!about && !sections.length && !links.length && !children) return null;
  return (
    <Section title="About" testID="club-about">
      {about ? <Text>{about}</Text> : null}
      {sections.map((section, index) => <ProfileSection key={index} section={section} parent="About" />)}
      {links.length ? <View accessibilityLabel="More from the club">{links.map(link => <LinkRow key={link.url} label={link.label} url={link.url} icon={link.video ? Play : undefined} />)}</View> : null}
      {children}
    </Section>
  );
}

/** What members do: programs, people and impact sections, projects, destinations, recognition, photos. */
export function MembersSection({ club }: { club: PublicClub }) {
  const { radius } = useTheme();
  const m = marketingOf(club);
  const sections = (m.sections ?? []).filter(section => section.visible && ["programs", "people", "impact"].includes(section.kind));
  const features = m.features ?? [];
  const placements = [...new Set((m.placements ?? []).map(name => name.trim()).filter(Boolean))];
  const accolades = (m.accolades ?? []).filter(Boolean);
  const gallery = (m.gallery ?? []).map(item => ({ ...item, uri: clubImage(item.url, config.apiUrl) })).filter(item => item.uri);
  if (!sections.length && !features.length && !placements.length && !accolades.length && !gallery.length) return null;
  return (
    <Section title="What members do" testID="club-members">
      {sections.map((section, index) => <ProfileSection key={index} section={section} parent="What members do" />)}
      {features.length ? (
        <View style={{ gap: 8 }}>
          <Subheading>Projects and highlights</Subheading>
          {features.map((feature, index) => (
            <View key={index} style={{ gap: 2 }}>
              <Text variant="bodyStrong">{feature.title}</Text>
              {feature.description ? <Text variant="small">{feature.description}</Text> : null}
              {feature.url ? <LinkRow label={`Learn more about ${feature.title}`} url={feature.url} /> : null}
            </View>
          ))}
        </View>
      ) : null}
      {placements.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}><Subheading>Where members go</Subheading><Text variant="caption">Club-reported</Text></View>
          <Bullets items={placements} />
        </View>
      ) : null}
      {accolades.length ? <View style={{ gap: 8 }}><Subheading>Recognition</Subheading><Bullets items={accolades} /></View> : null}
      {gallery.length ? (
        <View style={{ gap: 8 }}>
          <Subheading>A look inside</Subheading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {gallery.map((item, index) => (
              <View key={index} style={{ width: "48%", gap: 4 }}>
                <Image source={{ uri: item.uri! }} accessibilityLabel={item.caption || "Club activity"} contentFit="cover" transition={150} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md }} />
                {item.caption ? <Text variant="caption">{item.caption}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Section>
  );
}

/** The student's own place in the club's rounds (components/clubs/recruitment-timeline.tsx). */
function RecruitmentTimeline({ status, rounds, roundId }: { status: string; rounds: { id: string; name: string }[]; roundId?: string | null }) {
  const { colors } = useTheme();
  const labels = rounds.length ? rounds.map(round => round.name) : ["Submitted", "In review", "Interview", "Decision"];
  const draft = /draft/i.test(status);
  const fallbackStage = () => {
    const normalized = status.toUpperCase().replaceAll("_", " ");
    if (["SUBMITTED", "APPLIED"].includes(normalized)) return 0;
    if (["IN REVIEW", "REVIEW"].includes(normalized)) return 1;
    if (normalized.includes("INTERVIEW") || ["ROUND 1", "ROUND 2"].includes(normalized)) return 2;
    if (["ACCEPTED", "REJECTED", "WAITLISTED", "DECISION", "DECISION PENDING"].includes(normalized)) return 3;
    return -1;
  };
  const current = draft ? -1 : rounds.length ? (/ACCEPTED|REJECTED|WAITLISTED/i.test(status) ? labels.length - 1 : rounds.findIndex(round => round.id === roundId)) : fallbackStage();
  return (
    <View style={{ gap: 10 }}>
      <Text>Your application <Text variant="bodyStrong">{applicationStatusLabel(status)}</Text></Text>
      <View accessibilityLabel="Application recruitment timeline" style={{ gap: 8 }}>
        {labels.map((label, index) => {
          const complete = index < current, now = index === current;
          return (
            <View key={`${label}:${index}`} accessible accessibilityLabel={`${index + 1}. ${label}${now ? ", current step" : complete ? ", complete" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: now ? colors.primary : complete ? colors.successSubtle : colors.muted }}>
                {complete ? <Check size={14} color={colors.success} /> : <Text variant="caption" maxFontSizeMultiplier={1.3} color={now ? colors.primaryForeground : colors.mutedForeground}>{index + 1}</Text>}
              </View>
              <Text variant={now ? "bodyStrong" : "body"} style={{ flex: 1 }}>{label}</Text>
            </View>
          );
        })}
      </View>
      {current < 0 ? <Text variant="small">{draft ? "Your draft hasn’t been submitted yet." : "The club is using a custom stage. See your application for details."}</Text> : null}
    </View>
  );
}

/** Recruitment and requirements: deadline, the student's timeline, the club's recruitment notes, "Before you apply". */
export function RecruitmentSection({ club, deadlineText, expired, application }: { club: PublicClub; deadlineText: string; expired: boolean; application?: { status: string; roundId: string | null } }) {
  const m = marketingOf(club);
  const notes = (m.sections ?? []).filter(section => section.visible && section.kind === "recruitment");
  const requirements = club.requirements ?? [];
  const showRequirements = !!club.testRequirement || !!club.timeCommitment || requirements.length > 0;
  if (!deadlineText && !expired && !application && !showRequirements && !notes.length) return null;
  return (
    <Section title="Recruitment and requirements" testID="club-recruitment">
      {deadlineText ? <Text>{deadlineText}{expired ? " The deadline has passed. Existing drafts remain available." : ""}</Text> : null}
      {application ? <RecruitmentTimeline status={application.status} rounds={club.rounds ?? []} roundId={application.roundId} /> : null}
      {notes.map((section, index) => <ProfileSection key={index} section={section} parent="Recruitment and requirements" />)}
      {showRequirements ? (
        <View style={{ gap: 8 }}>
          <Subheading>Before you apply</Subheading>
          <Text>Your OutClass profile is the starting point for your application.</Text>
          {club.testRequirement ? <Text>Standardized tests: {club.testRequirement === "OPTIONAL" ? "SAT and ACT optional" : `${club.testRequirement.replaceAll("_", " ")} required`}. Scores come from your student profile.</Text> : null}
          {club.timeCommitment ? <Text>Time commitment: {club.timeCommitment} hours per week.</Text> : null}
          {requirements.length ? <><Text variant="smallStrong" accessibilityRole="header">Required club questions</Text><Bullets items={requirements} /></> : null}
        </View>
      ) : null}
    </Section>
  );
}

/** Life in the club: benefits, who can join, time commitment and dues. Unknown values are omitted. */
export function LifeSection({ club }: { club: PublicClub }) {
  const m = marketingOf(club);
  const benefits = (m.benefits ?? []).filter(Boolean);
  const facts = [{ label: "Who can join", value: m.eligibility }, { label: "Time commitment", value: m.commitment }, { label: "Membership dues", value: m.dues }].filter(fact => fact.value);
  if (!benefits.length && !facts.length) return null;
  return (
    <Section title="Life in the club" testID="club-life">
      {benefits.length ? <Bullets items={benefits} /> : null}
      {facts.length ? (
        <View style={{ gap: 10 }}>
          {facts.map(({ label, value }) => <View key={label} accessible style={{ gap: 2 }}><Text variant="caption">{label}</Text><Text>{value}</Text></View>)}
        </View>
      ) : null}
    </Section>
  );
}

export function FaqSection({ club }: { club: PublicClub }) {
  const { colors } = useTheme();
  const faqs = (marketingOf(club).faqs ?? []).filter(faq => faq.question && faq.answer);
  const [open, setOpen] = useState<number | null>(null);
  if (!faqs.length) return null;
  return (
    <View style={{ gap: 10 }} testID="club-faq">
      <Text variant="section" accessibilityRole="header">Frequently asked questions</Text>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {faqs.map((faq, index) => {
          const expanded = open === index;
          return (
            <View key={index}>
              {index ? <Divider /> : null}
              <Press large testID={`club-faq-${index}`} accessibilityLabel={faq.question} accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : index)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 8, paddingVertical: 10 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>{faq.question}</Text>
                {expanded ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
              </Press>
              {expanded ? <Text style={{ paddingBottom: 14 }}>{faq.answer}</Text> : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

/** Upcoming public events; each opens on the Events board's detail screen. */
export function ClubEventsSection({ events, onOpen }: { events: PublicClubEvent[]; onOpen: (event: PublicClubEvent) => void }) {
  const { colors } = useTheme();
  if (!events.length) return null;
  return (
    <View style={{ gap: 10 }} testID="club-events">
      <Text variant="section" accessibilityRole="header">Events</Text>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {events.map((event, index) => {
          const when = event.endDate ? eventScheduleLabel({ date: event.date, endDate: event.endDate, allDay: event.allDay }) : `${eventDateLabel(event.date)} · ${eventTimeLabel(event.date)}`;
          return (
            <View key={event.id}>
              {index ? <Divider /> : null}
              <Press large testID={`club-event-${index}`} accessibilityRole="link" accessibilityLabel={`${event.title}, ${when}${event.location ? `, ${event.location}` : ""}`} onPress={() => onOpen(event)} style={{ flexDirection: "row", gap: 12, paddingVertical: 12 }}>
                <View style={{ marginTop: 2 }}><CalendarDays size={18} color={colors.brandInk} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="bodyStrong">{event.title}</Text>
                  <Text variant="small">{when}</Text>
                  {event.location ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><MapPin size={14} color={colors.mutedForeground} /><Text variant="small" style={{ flex: 1 }}>{event.location}</Text></View> : null}
                  {event.description ? <Text variant="small" numberOfLines={3}>{event.description}</Text> : null}
                </View>
              </Press>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
