import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"

/** Authenticated workspace route: whole-destination cover while the server prepares the workspace.
 * Public routes have no route-level loading cover so their server HTML (and status) arrives first. */
export default function Loading() {
  return <OutClassLoadingScreen />
}
