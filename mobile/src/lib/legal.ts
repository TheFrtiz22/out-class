import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { config } from "~/lib/config";

/** The one support address, the web's CONTACT_EMAIL (lib/legal-content.ts). */
export const CONTACT_EMAIL = "hello@out-class.net";
/** The web's footer note: OutClass is not run by the university. */
export const INDEPENDENCE_NOTE = "OutClass is independent and is not an official service of the University of Virginia.";

/** Opens the website's Terms, Privacy or Copyright page in the in-app browser (Terms and Privacy are placeholders until they are published). */
export function openLegalPage(path: "/terms" | "/privacy" | "/copyright") {
  WebBrowser.openBrowserAsync(`${config.apiUrl}${path}`).catch(() => {});
}

/** Starts an email to OutClass support. The address is also shown on screen in case no mail app is set up. */
export function emailSupport() {
  Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
}
