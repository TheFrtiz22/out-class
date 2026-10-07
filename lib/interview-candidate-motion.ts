/** Capture only the three candidate panes; the header and column borders stay put. */
export function captureInterviewCandidate(stage: HTMLElement) {
  return { height: stage.offsetHeight, panes: [...stage.querySelectorAll<HTMLElement>(".oc-candidate-content")].map(content => {
    const copy = content.cloneNode(true) as HTMLElement;
    // Cloning a controlled field must retain its displayed value, not its default.
    const originals = content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea");
    copy.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach((field, i) => { field.value = originals[i].value; });
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    copy.querySelectorAll("[id],[name],[for]").forEach(el => { el.removeAttribute("id"); el.removeAttribute("name"); el.removeAttribute("for"); });
    return { copy, height: content.offsetHeight };
  }) };
}

/** One coordinated change, with no interactive or accessible outgoing controls. */
export function animateInterviewCandidate(stage: HTMLElement, outgoing: ReturnType<typeof captureInterviewCandidate>) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const incoming = [...stage.querySelectorAll<HTMLElement>(".oc-candidate-content")];
  const animations: Animation[] = [];
  const copies: HTMLElement[] = [];
  const previousMinimum = stage.style.minHeight;
  let settled = false;
  let settle: () => void;
  const finished = new Promise<void>(resolve => { settle = resolve; });
  const cleanup = () => {
    if (settled) return;
    settled = true;
    animations.forEach(animation => animation.cancel());
    copies.forEach(copy => copy.remove());
    incoming.forEach(content => { content.inert = false; });
    stage.style.minHeight = previousMinimum;
    window.removeEventListener("resize", cleanup);
    media.removeEventListener("change", cleanup);
    settle();
  };
  if (!media.matches && incoming.every(content => typeof content.animate === "function")) {
    stage.style.minHeight = `${Math.max(stage.offsetHeight, outgoing.height)}px`;
    incoming.forEach((content, i) => {
      content.inert = true;
      const old = outgoing.panes[i];
      if (old) {
        const copy = old.copy;
        copy.classList.add("oc-candidate-outgoing");
        Object.assign(copy.style, { position: "absolute", top: `${content.offsetTop}px`, left: `${content.offsetLeft}px`, width: `${content.offsetWidth}px` });
        content.parentElement!.append(copy);
        copies.push(copy);
        animations.push(copy.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(-56px)", opacity: 0 }], { duration: 750 * .65, easing: "cubic-bezier(.4,0,.16,1)", fill: "both" }));
      }
      animations.push(content.animate([{ transform: "translateX(56px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 750 * .8, delay: 750 * .2, easing: "cubic-bezier(.4,0,.16,1)", fill: "both" }));
    });
    window.addEventListener("resize", cleanup);
    media.addEventListener("change", cleanup);
    void Promise.allSettled(animations.map(animation => animation.finished)).then(cleanup);
  } else cleanup();
  return { finished, cancel: cleanup };
}
