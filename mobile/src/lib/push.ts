/**
 * TODO(push): placeholder. The real module (device token registration through the mobile API,
 * permission prompts and notification handling) is being written separately and replaces this
 * file. Until then push reports "unavailable" and the settings row explains that.
 *
 * The interface the settings row depends on:
 *   status()  -> whether this device currently receives push for the signed-in account
 *   enable()  -> ask for permission if needed and register; false when it did not turn on
 *   disable() -> stop push for this device
 */
export type PushStatus = "on" | "off" | "denied" | "unavailable";
export type PushControl = { status(): Promise<PushStatus>; enable(): Promise<boolean>; disable(): Promise<void> };

export const push: PushControl = {
  async status() { return "unavailable"; },
  async enable() { return false; },
  async disable() { /* nothing registered */ },
};
