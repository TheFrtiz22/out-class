import { z } from "zod";
import { isUvaEmail } from "@/lib/auth";
import { newPasswordSchema } from "@/lib/password-policy";

export const recoveryEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email()
  .refine(isUvaEmail);
export const newPassword = newPasswordSchema;
export const passwordReset = z
  .object({
    tokenHash: z
      .string()
      .min(16)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/),
    password: newPassword,
    confirmation: z.string(),
    authenticatorCode: z.string().regex(/^\d{6}$/).optional(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Passwords must match.",
    path: ["confirmation"],
  });
export const recoveryConfirmation =
  "If an account exists for that email, we’ll send a password reset link. Check your inbox and spam folder.";
