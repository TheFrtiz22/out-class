"use client";

import { AuthView } from "@/components/views/auth-view";
import dynamic from "next/dynamic";
import { useState } from "react";
import { signInReturnPath } from "@/lib/auth";
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen";

const StudentOnboardingWizard = dynamic(() => import("@/components/views/student-onboarding-wizard").then(module => module.StudentOnboardingWizard), { loading: () => <OutClassLoadingScreen /> });

export default function LoginPage() {
  const [creatingAccount, setCreatingAccount] = useState(false);
  if (creatingAccount) return <StudentOnboardingWizard
    onBack={() => { window.location.href = "/"; }}
    onSignIn={() => setCreatingAccount(false)}
    onComplete={() => { window.location.href = signInReturnPath(new URLSearchParams(window.location.search).get("next")); }}
  />;
  return (
    <AuthView
      onCreateAccount={() => setCreatingAccount(true)}
      onBack={() => {
        window.location.href = "/";
      }}
      onEnter={() => {
        window.location.href = "/";
      }}
    />
  );
}
