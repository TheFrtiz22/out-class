import * as Haptics from "expo-haptics";

/** The one place haptics are chosen, so the same event always feels the same. */
const run = (play: () => Promise<void>) => { play().catch(() => { /* unsupported device: silent */ }); };

export const haptics = {
  /** A confirmed action: saved, submitted, booked, followed. */
  confirm: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A check-in recorded, in either direction. */
  checkIn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A ballot cast. */
  vote: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** A light save or toggle. */
  save: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A soft notice: already checked in, nothing changed. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A refusal or failure. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** A control picked up under the finger: the tab bar's selection, lifted to drag. */
  grab: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** Selection moved: a tab, a segment, a voting round tick. */
  tick: () => run(() => Haptics.selectionAsync()),
};
