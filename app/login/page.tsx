"use client";

import { AuthView } from "@/components/views/auth-view";
export default function LoginPage() {
  return (
    <AuthView
      onBack={() => {
        window.location.href = "/";
      }}
      onEnter={() => {
        window.location.href = "/";
      }}
    />
  );
}
