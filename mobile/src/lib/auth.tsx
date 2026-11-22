import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { clearPrivateMemory } from "~/lib/private-memory";
import { missingConfigMessage, signInFailure, type SignInFailure } from "~/lib/sign-in-error";
import { supabase } from "~/lib/supabase";

type AuthValue = {
  /** undefined while the stored session is being read. */
  session: Session | null | undefined;
  /** null on success; otherwise what to tell the person, and whether a Turnstile check is needed first. */
  signIn: (email: string, password: string, captchaToken?: string) => Promise<SignInFailure | null>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthValue>({ session: undefined, signIn: async () => null, signOut: async () => {} });

/** Leader-private data held in memory is dropped after this long in the background. */
const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const queryClient = useQueryClient();
  const userId = useRef<string | null>(null);

  useEffect(() => {
    // A session that can't be read (an unreadable key-store entry) reads as signed out, never as loading forever.
    supabase.auth.getSession().then(({ data }) => { userId.current = data.session?.user.id ?? null; setSession(data.session); }, () => { userId.current = null; setSession(null); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id ?? null;
      // A different account (or none) must never see the previous account's cached data.
      if (nextId !== userId.current) { queryClient.clear(); clearPrivateMemory(); }
      userId.current = nextId;
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener("change", state => {
      if (state === "background") leftAt = Date.now();
      if (state === "active" && leftAt !== null) {
        if (Date.now() - leftAt > BACKGROUND_TIMEOUT_MS) { clearPrivateMemory(); queryClient.removeQueries({ queryKey: ["leader"] }); }
        leftAt = null;
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const missing = missingConfigMessage();
    if (missing) return { message: missing, needsCaptcha: false };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: captchaToken ? { captchaToken } : undefined });
      return error ? signInFailure(error) : null;
    } catch (thrown) {
      // A failure before any answer (a malformed address, a storage error) still gets a message.
      return signInFailure(thrown instanceof Error ? { name: thrown.name, message: thrown.message } : { message: String(thrown) });
    }
  }, []);

  const signOut = useCallback(async () => {
    // While the session can still authorize it: stop this device's pushes for the account.
    await import("~/lib/push").then(module => module.unregisterPushBeforeSignOut()).catch(() => {});
    // A bad connection must not hold Sign out: after 5 s this device signs out locally.
    const remote = supabase.auth.signOut().then(({ error }) => { if (error) throw error; });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
    await Promise.race([remote, timeout]).catch(() => supabase.auth.signOut({ scope: "local" }));
    queryClient.clear();
    clearPrivateMemory();
    // Unsaved application answers kept on this device for offline recovery go with the account.
    await import("~/lib/autosave").then(module => module.clearDeviceDrafts()).catch(() => {});
  }, [queryClient]);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
