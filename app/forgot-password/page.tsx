import { PasswordRecovery } from "@/components/password-recovery";
export const metadata = {
  title: "Forgot password · OutClass",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ForgotPasswordPage() {
  return <PasswordRecovery mode="request" />;
}
