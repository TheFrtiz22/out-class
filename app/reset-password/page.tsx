import { PasswordRecovery } from "@/components/password-recovery";
export const metadata = {
  title: "Reset password · OutClass",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ResetPasswordPage() {
  return <PasswordRecovery mode="reset" />;
}
