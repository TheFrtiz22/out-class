"use server";
import { prisma } from "@/utils/prisma";
import {
  saveMeeting,
  checkInMeeting,
  meetingAttendance,
} from "@/actions/meetings";
// Compatibility adapters: recruitment and member meetings share one persisted model.
export async function createEvent(data: {
  clubId: string;
  title: string;
  date: Date;
  location: string;
  description?: string;
  isPublic?: boolean;
}) {
  return {
    event: await saveMeeting({
      ...data,
      audience: data.isPublic === false ? "MEMBERS" : "RECRUITMENT",
    }),
    success: true,
  };
}
export async function getClubEvents(clubId: string) {
  return {
    events: await prisma.meeting.findMany({
      where: { clubId, isPublic: true, audience: "RECRUITMENT" },
      select: {
        id: true,
        clubId: true,
        title: true,
        description: true,
        date: true,
        location: true,
        isPublic: true,
      },
      orderBy: { date: "asc" },
    }),
  };
}
export async function recordEventAttendance(eventId: string, token?: string) {
  if (!token)
    throw new Error(
      "A current meeting QR code is required. Static attendance links are no longer accepted.",
    );
  return checkInMeeting(eventId, token);
}
export async function getEventAttendees(eventId: string, clubId: string) {
  return { attendees: await meetingAttendance(clubId, eventId) };
}
