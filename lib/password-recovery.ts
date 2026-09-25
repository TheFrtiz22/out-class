import { z } from "zod";
import { isUvaEmail } from "@/lib/auth";

export const recoveryEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email()
  .refine(isUvaEmail);
export const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use no more than 128 characters.");
export const passwordReset = z
  .object({
    tokenHash: z
      .string()
      .min(16)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/),
    password: newPassword,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Passwords must match.",
    path: ["confirmation"],
  });
export const recoveryConfirmation =
  "If an eligible account exists for that email, we’ll send a password reset link. Check your inbox and spam folder.";
