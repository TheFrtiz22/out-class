import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * The website's time-of-day greeting (lib/welcome.ts welcomeGreeting), word for word: device-local
 * time, never the school's time zone. Before 5 AM and from 9 PM it asks "Still up?".
 */
export function welcomeGreeting(now: Date | null, firstName?: string | null) {
  const name = firstName?.trim();
  if (!now || !Number.isFinite(+now)) return name ? `Welcome, ${name}.` : "Welcome to OutClass.";
  const hour = now.getHours();
  if (hour < 5 || hour >= 21) return name ? `Still up, ${name}?` : "Still up?";
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${salutation}${name ? `, ${name}` : ""}.`;
}

/** The same words as a bar title: the sentence's full stop is dropped ("Good morning, Jesse"), a question keeps its mark. */
export const headerGreeting = (now: Date | null, firstName?: string | null) => welcomeGreeting(now, firstName).replace(/\.$/, "");

/**
 * The current time, refreshed each minute and whenever the app comes back to the foreground,
 * so a greeting written in the morning reads "Good evening" when the phone is picked up at night.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [intervalMs]);
  return now;
}
