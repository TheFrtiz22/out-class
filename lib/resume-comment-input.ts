type InputKey = { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; altGraph?: boolean; isComposing?: boolean; keyCode?: number; defaultPrevented?: boolean };
/** Only an authorized PDF text selection may use this result. Commands and
 * editable targets remain native; composition gets a real textarea first. */
export function resumeCommentInput(event: InputKey, interactiveTarget: boolean) {
  if (interactiveTarget || event.defaultPrevented || event.metaKey || event.ctrlKey && !event.altGraph) return null;
  if (event.isComposing || event.keyCode === 229 || event.key === "Process" || event.key === "Dead") return { text: "", nativeComposition: true };
  if (event.altKey && !event.altGraph || [...event.key].length !== 1) return null;
  return { text: event.key, nativeComposition: false };
}
