type Box = { left: number; top: number; width: number; height: number };
export type QuestionCompletionOrigin = { box: Box; height: number };
export function captureQuestionCompletion(source: HTMLElement | null): QuestionCompletionOrigin | null {
  if (!source || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const box = source.getBoundingClientRect();
  return { box: { left: box.left, top: box.top, width: box.width, height: box.height }, height: source.offsetHeight };
}

/** Cosmetic only: invoked after the existing save acknowledges personal completion. */
export function animateQuestionCompletion(origin: QuestionCompletionOrigin, source: HTMLElement, row: HTMLElement, onFinish: () => void): () => void {
  const animations: Animation[] = [];
  let ghost: HTMLElement | undefined, settled = false;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finish = () => {
    if (settled) return; settled = true;
    animations.forEach(animation => animation.cancel()); ghost?.remove();
    window.removeEventListener("resize", finish); window.removeEventListener("scroll", finish, true);
    media.removeEventListener("change", finish); onFinish();
  };
  if (media.matches || !source.animate || !row.animate) { finish(); return finish; }
  window.addEventListener("resize", finish); window.addEventListener("scroll", finish, true); media.addEventListener("change", finish);
  try {
    const target = row.getBoundingClientRect(), height = source.offsetHeight;
    const timing = { duration: 760, easing: "cubic-bezier(.4,0,.16,1)", fill: "both" as const };
    animations.push(source.animate([{ height: `${origin.height}px`, overflow: "hidden" }, { height: `${height}px`, overflow: "hidden" }], timing));
    animations.push(source.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 460, delay: 300, easing: "ease", fill: "both" }));
    animations.push(row.animate([{ height: "0px", overflow: "hidden" }, { height: `${target.height}px`, overflow: "hidden" }], { duration: 320, easing: "cubic-bezier(.4,0,.16,1)", fill: "both" }));
    const travel = window.matchMedia("(min-width: 1024px)").matches && target.top >= 0 && target.bottom <= window.innerHeight && origin.box.top >= 0;
    if (travel) {
      // A compact, fixed-size summary travels. Text never scales or changes width.
      ghost = (row.querySelector(".oc-completed-row") || row).cloneNode(true) as HTMLElement;
      for (const element of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
        ["id", "name", "for", "aria-controls", "aria-expanded"].forEach(attribute => element.removeAttribute(attribute));
        element.removeAttribute("autofocus");
      }
      ghost.className = "oc-question-completion-flight"; ghost.inert = true; ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { left: `${origin.box.left}px`, top: `${origin.box.top}px`, width: `${target.width}px`, height: `${target.height}px` });
      document.body.append(ghost);
      animations.push(ghost.animate([{ transform: "translate(0,0)" }, { transform: `translate(${target.left - origin.box.left}px,${target.top - origin.box.top}px)` }], timing));
      animations.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, delay: 510, easing: "ease-in-out", fill: "both" }));
      animations.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 510, easing: "ease-in-out", fill: "both" }));
    } else {
      // Stacked layouts stay local; never fly toward an offscreen mobile panel.
      animations.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 510, easing: "ease-in-out", fill: "both" }));
    }
    void Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  } catch { finish(); }
  return finish;
}
