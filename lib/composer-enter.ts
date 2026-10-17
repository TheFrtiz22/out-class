type ComposerKey = {
  key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean;
  repeat: boolean; defaultPrevented: boolean;
  nativeEvent: { isComposing?: boolean; keyCode?: number };
  preventDefault(): void; stopPropagation(): void;
};

/** Explicit composer actions only; never attach to the enclosing interview form. */
export function composerEnter(event: ComposerKey, submit: () => unknown) {
  if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  event.preventDefault(); event.stopPropagation();
  if (!event.repeat) void submit();
}
