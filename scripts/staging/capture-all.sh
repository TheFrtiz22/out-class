#!/bin/bash
# Full screenshot pass for one platform on an installed RELEASE build (see docs/mobile/screenshots/index.html).
# Usage: scripts/staging/capture-all.sh ios <simulator-udid> | android <adb-serial>
set -u
PLATFORM="$1"; DEVICE="$2"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
OUT="docs/mobile/screenshots/$PLATFORM"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
export MAESTRO_DEVICE="$DEVICE"
theme() { if [ "$PLATFORM" = ios ]; then xcrun simctl ui "$DEVICE" appearance "$1"; else "$ADB" shell cmd uimode night "$([ "$1" = dark ] && echo yes || echo no)"; fi; sleep 2; }
open_link() { if [ "$PLATFORM" = ios ]; then xcrun simctl openurl "$DEVICE" "$1"; else "$ADB" shell am start -W -a android.intent.action.VIEW -d "'$1'" net.outclass.app >/dev/null; fi; }
shot() { mkdir -p "$(dirname "$1")"; if [ "$PLATFORM" = ios ]; then xcrun simctl io "$DEVICE" screenshot "$1" >/dev/null 2>&1; else "$ADB" exec-out screencap -p > "$1"; fi; }
reset_app() { if [ "$PLATFORM" = ios ]; then xcrun simctl terminate "$DEVICE" net.outclass.app 2>/dev/null; xcrun simctl keychain "$DEVICE" reset; else "$ADB" shell pm clear net.outclass.app >/dev/null; fi; }
sign_in() { reset_app; node scripts/staging/maestro.cjs "e2e/release-$1.yaml" 2>&1 | grep -E 'FAILED' | tail -2; }
both() { for T in light dark; do node scripts/staging/capture.cjs "$PLATFORM" "$DEVICE" "$T" "$1" | tail -1; done; }

rm -f "$OUT"/light/*.png "$OUT"/dark/*.png
sign_in student
node scripts/staging/maestro.cjs e2e/enable-push.yaml 2>&1 | grep -E 'FAILED' | tail -1
both student
for T in light dark; do
  theme "$T"
  CODE="$(node scripts/staging/issue-code.cjs)"; open_link "outclass://scan?code=$CODE"; sleep 9; shot "$OUT/$T/26-check-in-result.png"
  open_link "outclass://club/this-club-does-not-exist"; sleep 6; shot "$OUT/$T/28-error-state.png"
  if [ "$PLATFORM" = ios ]; then
    open_link "outclass://"; sleep 3
    xcrun simctl push "$DEVICE" net.outclass.app scripts/staging/push-sample.json >/dev/null 2>&1; sleep 3; shot "$OUT/$T/27-push-banner.png"; sleep 6
  fi
done
# Offline: stop the API, open a screen with nothing cached, capture, then start the API again.
pkill -f 'next start'; pkill -f 'next-server'; sleep 2
for T in light dark; do theme "$T"; open_link "outclass://club/rotunda-equity-research"; sleep 10; shot "$OUT/$T/29-offline-state.png"; done
(nohup npx -y pnpm@10.17.1 exec next start -p 3000 < /dev/null > /dev/null 2>&1 &); sleep 10
sign_in leader; both leader
sign_in alumni; both alumni
reset_app
if [ "$PLATFORM" = ios ]; then xcrun simctl launch "$DEVICE" net.outclass.app >/dev/null; else "$ADB" shell monkey -p net.outclass.app 1 >/dev/null 2>&1; fi; sleep 7
both signedout
theme light
echo "light: $(ls "$OUT/light" | wc -l)  dark: $(ls "$OUT/dark" | wc -l)"
