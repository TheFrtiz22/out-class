import { useRouter } from "expo-router";
import { Linking, View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { Mail } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Card, ScreenScroll } from "~/components/ui";
import { useTheme } from "~/lib/theme";

/** The support address (lib/legal-content.ts `CONTACT_EMAIL` on the web). */
export const SUPPORT_EMAIL = "hello@out-class.net";
export const SUPPORT_HREF = `mailto:${SUPPORT_EMAIL}`;
/** The web says the same on /about and in its footer (components/landing/public-footer.tsx). */
export const NOT_AFFILIATED = "OutClass is independent and not affiliated with or endorsed by the University of Virginia.";

/** Opens the phone's mail app addressed to support. A phone with no mail app keeps the address on screen to copy. */
export function contactSupport() {
  Linking.openURL(SUPPORT_HREF).catch(() => {});
}

export type LegalDocument = "terms" | "privacy";
export const LEGAL_ROUTES = { terms: "/legal/terms", privacy: "/legal/privacy" } as const;
const TITLES: Record<LegalDocument, string> = { terms: "Terms of Service", privacy: "Privacy Policy" };

/**
 * The in-app Terms of Service and Privacy Policy. Both are placeholders until the owner and counsel
 * finish the text (lib/legal-content.ts on the web is still a draft and not public); the full text
 * replaces this screen's body before launch. Reachable signed out, from Sign in (src/app/_layout.tsx).
 */
export function LegalPlaceholder({ document }: { document: LegalDocument }) {
  const { colors } = useTheme();
  const top = useHeaderInset();
  const title = TITLES[document];
  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID={`legal-${document}-screen`}>
        <Card style={{ gap: 12 }}>
          <Text variant="section" accessibilityRole="header">Our {title} {document === "terms" ? "are" : "is"} being finalized</Text>
          <Text variant="body">The full {title} will appear here before OutClass launches.</Text>
          <Text variant="small" color={colors.foreground}>Questions in the meantime? Email us at <Text variant="smallStrong" selectable>{SUPPORT_EMAIL}</Text>.</Text>
          <Button variant="secondary" icon={Mail} testID={`legal-${document}-contact`} label="Contact support" accessibilityHint={`Emails ${SUPPORT_EMAIL}`} onPress={contactSupport} />
        </Card>
        <Text variant="caption" align="center" style={{ paddingHorizontal: 8 }}>{NOT_AFFILIATED}</Text>
      </ScreenScroll>
      <Header title={title} back />
    </View>
  );
}

/** "By continuing, you agree to our Terms of Service and Privacy Policy." with both names opening the in-app screens. */
export function AgreementLine() {
  const { colors } = useTheme();
  const router = useRouter();
  const link = (document: LegalDocument) => (
    <Text variant="smallStrong" color={colors.primary} accessibilityRole="link" testID={`sign-in-${document}`}
      onPress={() => router.push(LEGAL_ROUTES[document])}>{TITLES[document]}</Text>
  );
  return (
    <Text variant="small" color={colors.mutedForeground} align="center" testID="sign-in-agreement">
      By continuing, you agree to our {link("terms")} and {link("privacy")}.
    </Text>
  );
}
