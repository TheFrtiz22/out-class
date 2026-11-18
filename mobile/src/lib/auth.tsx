import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { clearPrivateMemory } from "~/lib/private-memory";
import { supabase } from "~/lib/supabase";

type AuthValue = {
  /** undefined while the stored session is being read. */
  session: Session | null | undefined;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<string | null>;
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
    supabase.auth.getSession().then(({ data }) => { userId.current = data.session?.user.id ?? null; setSession(data.session); });
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: captchaToken ? { captchaToken } : undefined });
    if (!error) return null;
    // The web's wording (app/login). Supabase's own messages are not shown.
    if (error.status === 400) return "That email or password isn't right.";
    if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
    return "We couldn't sign you in just now. Try again in a moment.";
  }, []);

  const signOut = useCallback(async () => {
    // While the session can still authorize it: stop this device's pushes for the account.
    await import("~/lib/push").then(module => module.unregisterPushBeforeSignOut()).catch(() => {});
    await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: "local" }));
    queryClient.clear();
    clearPrivateMemory();
  }, [queryClient]);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
