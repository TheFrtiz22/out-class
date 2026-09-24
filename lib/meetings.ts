import { z } from "zod";
import { type ClubAccess } from "@/lib/permissions";
export const meetingAudiences = ["RECRUITMENT", "MEMBERS"] as const;
export const resourceSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(150),
  kind: z.enum(["LINK", "FILE", "SLIDES"]),
  url: z
    .string()
    .url()
    .max(3000)
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Use an HTTP or HTTPS link.",
    ),
});
export const meetingInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    clubId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).default(""),
    date: z.coerce.date(),
    endDate: z.coerce.date().nullable().default(null),
    location: z.string().trim().min(1).max(500),
    audience: z.enum(meetingAudiences),
    agenda: z.string().max(20000).default(""),
    recap: z.string().max(20000).default(""),
    resources: z.array(resourceSchema).max(30).default([]),
    revision: z.number().int().min(0).default(0),
  })
  .refine(
    (m) => !m.endDate || m.endDate > m.date,
    "End time must follow the start.",
  );
export function canReadMeeting(
  meeting: { audience: string; isPublic: boolean },
  membership: ClubAccess | null,
) {
  return (
    (meeting.audience === "RECRUITMENT" && meeting.isPublic) || !!membership
  );
}
export function canCheckIn(
  meeting: { audience: string; isPublic: boolean },
  membership: ClubAccess | null,
) {
  return canReadMeeting(meeting, membership);
}
export const meetingFields = {
  id: true,
  clubId: true,
  title: true,
  description: true,
  date: true,
  endDate: true,
  location: true,
  audience: true,
  isPublic: true,
  agenda: true,
  recap: true,
  resources: true,
  revision: true,
  club: { select: { name: true } },
} as const;
export const TOKEN_LIFETIME_MS = 90_000;
export type CheckInResult = {
  status: "checked-in" | "already-checked-in";
  checkedInAt: string;
};
