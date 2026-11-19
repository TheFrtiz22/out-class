import { useLocalSearchParams } from "expo-router";
import { ScanScreen } from "~/app/scan";

/**
 * `/q/<code>`: the same path as the site's first-party short links, so a universal link (or the
 * app link on Android) lands here and the code is redeemed with the signed-in session, with no
 * browser hop. The server decides what the code is and whether this account may use it.
 */
export default function ShortLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ScanScreen initialCode={/^[a-zA-Z0-9_-]{1,32}$/.test(code ?? "") ? code : "invalid"} />;
}
