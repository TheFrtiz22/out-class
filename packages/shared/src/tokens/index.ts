/**
 * OutClass design tokens, resolved for React Native. tokens.json is the single source: the web stylesheet
 * (styles/tokens.css) is rendered from it by packages/shared/scripts/build-web-tokens.cjs, and this module
 * resolves the same raw CSS values into concrete colours and numbers. No Node or DOM APIs.
 */
import tokens from "./tokens.json";

export type Scheme = "light" | "dark";
type Scope = Record<string, string>;

const schoolScopes: Record<string, Scope> = tokens.schools;
export const defaultSchool: string = tokens.defaultSchool;
export const schools: string[] = Object.keys(schoolScopes);

/** School layer, then the light root, then (dark only) the dark overrides: later scopes win. */
function scopeFor(scheme: Scheme, school: string): Scope {
  const layer = schoolScopes[school];
  if (!layer) throw new Error(`Unknown school "${school}"`);
  return { ...layer, ...(tokens.root as Scope), ...(scheme === "dark" ? (tokens.dark as Scope) : {}) };
}

/** The raw value of a token with every var(--x) reference replaced, recursively. */
function resolveRaw(scope: Scope, name: string, depth = 0): string {
  const raw = scope[name];
  if (raw === undefined) throw new Error(`Unknown token --${name}`);
  if (depth > 12) throw new Error(`Circular token reference at --${name}`);
  return raw.replace(/var\(--([a-z0-9-]+)\)/g, (_, ref: string) => resolveRaw(scope, ref, depth + 1)).trim();
}

/** A colour React Native accepts: hex passes through; `rgb(r g b / a%)` becomes `rgba(r,g,b,a)`. */
function toColor(value: string, name: string): string {
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[/,]\s*([\d.]+)(%?)\s*)?\)$/);
  if (!rgb) throw new Error(`--${name} is not a colour React Native accepts: ${value}`);
  const [, r, g, b, alpha, percent] = rgb;
  if (alpha === undefined) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${round(percent ? Number(alpha) / 100 : Number(alpha))})`;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/** A length, time or plain number: rem ×16 → px, px, ms, em and unitless as is; clamp(min, …) → min. */
function toNumber(value: string, name: string): number {
  const clamp = value.match(/^clamp\(\s*([^,]+),/);
  const match = (clamp ? clamp[1].trim() : value).match(/^(-?(?:\d+\.?\d*|\.\d+))(rem|px|ms|em)?$/);
  if (!match) throw new Error(`--${name} is not a number: ${value}`);
  return round(Number(match[1]) * (match[2] === "rem" ? 16 : 1));
}

/** Maps friendly keys to token names, keeping the keys as the result's type. */
function pick<K extends string, V>(scope: Scope, names: Record<K, string>, convert: (value: string, name: string) => V): Record<K, V> {
  const out = {} as Record<K, V>;
  for (const key of Object.keys(names) as K[]) out[key] = convert(resolveRaw(scope, names[key]), names[key]);
  return out;
}

const COLORS = {
  background: "background", foreground: "foreground", card: "card", cardForeground: "card-foreground",
  popover: "popover", popoverForeground: "popover-foreground", primary: "primary", primaryForeground: "primary-foreground",
  secondary: "secondary", secondaryForeground: "secondary-foreground", muted: "muted", mutedForeground: "muted-foreground",
  accent: "accent", accentForeground: "accent-foreground", brandOrange: "brand-orange", brandSubtle: "brand-subtle", brandInk: "brand-ink",
  destructive: "destructive", destructiveForeground: "destructive-foreground", errorSubtle: "error-subtle",
  success: "success", successSubtle: "success-subtle", warning: "warning", warningSubtle: "warning-subtle",
  info: "info", infoSubtle: "info-subtle", interview: "interview", interviewSubtle: "interview-subtle",
  border: "border", input: "input", ring: "ring", focusHalo: "focus-halo", overlay: "overlay",
  contentSoft: "oc-content-soft", contentSoftBlue: "oc-content-soft-blue",
  surfaceBlue: "oc-surface-blue", surfaceSage: "oc-surface-sage", surfaceLilac: "oc-surface-lilac", surfaceWarm: "oc-surface-warm",
  rail: "oc-rail", railText: "oc-rail-text", railMuted: "oc-rail-muted", railSelected: "oc-rail-selected", railRule: "oc-rail-rule",
  votePass: "oc-vote-pass", voteFail: "oc-vote-fail", voteHeld: "oc-vote-held", voteTrack: "oc-vote-track", voteMarker: "oc-vote-marker",
  schoolPrimary: "school-primary", schoolAccent: "school-accent", schoolAccentText: "school-accent-text", schoolAccentOnDark: "school-accent-on-dark",
} as const;

const RADIUS = { sm: "oc-radius-sm", md: "oc-radius-md", lg: "oc-radius-lg", xl: "oc-radius-xl", xl2: "oc-radius-2xl", full: "oc-radius-full" } as const;
const SPACE = { unit: "oc-space-unit", control: "oc-space-control", content: "oc-space-content", section: "oc-space-section" } as const;
const TEXT = {
  caption: "oc-text-caption", small: "oc-text-small", body: "oc-text-body", card: "oc-text-card", modal: "oc-text-modal",
  metric: "oc-text-metric", section: "oc-text-section", title: "oc-text-title",
} as const;
const WEIGHTS = {
  regular: "oc-weight-regular", medium: "oc-weight-medium", semibold: "oc-weight-semibold", bold: "oc-weight-bold",
  title: "oc-weight-title", display: "oc-weight-display",
} as const;
const LEADING = {
  heading: "oc-leading-heading", subheading: "oc-leading-subheading", compact: "oc-leading-compact", body: "oc-leading-body", display: "oc-leading-display",
} as const;
const TRACKING = {
  heading: "oc-tracking-heading", title: "oc-tracking-title", section: "oc-tracking-section", card: "oc-tracking-card",
  small: "oc-tracking-small", caps: "oc-tracking-caps", display: "oc-tracking-display",
} as const;
const DURATION = {
  micro: "oc-duration-micro", ui: "oc-duration-ui", entrance: "oc-duration-entrance", signature: "oc-duration-signature", pressIn: "oc-press-in",
} as const;
const PRESS = { scale: "oc-press-scale", scaleLarge: "oc-press-scale-large" } as const;
const CONTROL_HEIGHT = { default: "oc-control-height", compact: "oc-control-height-compact", large: "oc-control-height-large" } as const;
const Z = { sticky: "oc-z-sticky", overlay: "oc-z-overlay", modal: "oc-z-modal", popover: "oc-z-popover", tooltip: "oc-z-tooltip", toast: "oc-z-toast" } as const;

/** Every --oc-size-N step as { N: px }. */
function sizes(scope: Scope): Record<number, number> {
  const out: Record<number, number> = {};
  for (const name of Object.keys(scope)) {
    const step = name.match(/^oc-size-(\d+)$/);
    if (step) out[Number(step[1])] = toNumber(resolveRaw(scope, name), name);
  }
  return out;
}

/** The resolved theme for one colour scheme and school. Lengths are px, durations ms, tracking em. */
export function resolveTheme(scheme: Scheme, school: string = defaultSchool) {
  const scope = scopeFor(scheme, school);
  return {
    scheme,
    school,
    colors: pick(scope, COLORS, toColor),
    radius: pick(scope, RADIUS, toNumber),
    space: pick(scope, SPACE, toNumber),
    size: sizes(scope),
    text: pick(scope, TEXT, toNumber),
    weights: pick(scope, WEIGHTS, toNumber),
    leading: pick(scope, LEADING, toNumber),
    tracking: pick(scope, TRACKING, toNumber),
    duration: pick(scope, DURATION, toNumber),
    press: pick(scope, PRESS, toNumber),
    controlHeight: pick(scope, CONTROL_HEIGHT, toNumber),
    z: pick(scope, Z, toNumber),
  };
}

export type Theme = ReturnType<typeof resolveTheme>;
export type ThemeColor = keyof Theme["colors"];
