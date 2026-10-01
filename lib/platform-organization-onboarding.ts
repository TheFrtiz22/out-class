import { z } from "zod";
import type { InvitationStatus, SchoolIdentifierType } from "@prisma/client";
import { normalizeSchoolIdentifier } from "@/lib/club-onboarding";

const cleanName = z.string().trim().min(2, "Enter at least two characters.").max(150)
  .refine(value => !/[\x00-\x1f\x7f]/.test(value), "Names cannot contain control characters.")
  .transform(value => value.normalize("NFKC").replace(/\s+/g, " "))
  .pipe(z.string().min(2).max(150).refine(value => /[\p{L}\p{N}]/u.test(value), "Enter a name containing letters or numbers."));

export const organizationOnboardingSchema = z.object({
  requestId: z.string().uuid(),
  identifierTypeId: z.string().min(1, "Choose a school.").max(100),
  organizationName: cleanName,
  presidentName: cleanName,
  presidentIdentifier: z.string().trim().min(1, "Enter the president's university identifier.").max(128),
  presidentYear: z.string().trim().regex(/^\d{4}$/, "Enter a four-digit graduation year.")
    .refine(value => Number(value) >= 2000 && Number(value) <= 2100, "Enter a year between 2000 and 2100."),
  reason: z.string().trim().min(10, "Explain the onboarding reason in at least 10 characters.").max(1000),
}).strict();

export type OrganizationOnboardingSchool = {
  identifierTypeId: string;
  schoolName: string;
  identifierLabel: string;
  normalization: SchoolIdentifierType["normalization"];
  validationRegex: string | null;
};

export function onboardingIdentifierPattern(config: Pick<SchoolIdentifierType, "key" | "validationRegex"> & { school: { key: string } }) {
  // UVA's delivery-address grammar also permits email aliases. A computing ID
  // must be an institutional identifier, not an alias or a full email address.
  return config.school.key === "uva" && config.key === "computing_id" ? "^[a-z][a-z0-9]{1,31}$" : config.validationRegex;
}

export function normalizePresidentIdentifier(value: string, school: Pick<OrganizationOnboardingSchool, "normalization" | "validationRegex">) {
  return normalizeSchoolIdentifier(value, school);
}

export function organizationNameKey(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export type OrganizationOnboardingResult = {
  ok: true;
  organization: { id: string; name: string };
  invitation: { id: string; state: InvitationStatus; identifier: string; email: string; expiresAt: string; url: string };
  accountMatch: "EXISTING" | "NEW";
  reused: boolean;
  emailDelivery: "NOT_SENT";
} | {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
