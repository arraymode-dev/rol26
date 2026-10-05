/** Expand once, holding the content in place until the panel finishes growing. */
export function expandOnScroll(content: HTMLElement, expand: () => void) {
  let expanded = false;
  let locked = false;
  let start: { x: number; y: number } | null = null;
  const initialScroll = content.scrollTop;
  const panel = content.parentElement;
  const overflow = content.style.overflowY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    if (timer !== undefined) clearTimeout(timer);
    if (!locked) return;
    locked = false;
    content.style.overflowY = overflow;
  };
  const preventScroll = (event: Event) => {
    if (locked && event.cancelable) event.preventDefault();
  };
  const trigger = (event?: Event) => {
    if (expanded) return;
    expanded = true;
    locked = true;
    content.style.overflowY = "hidden";
    content.scrollTop = initialScroll;
    if (event) preventScroll(event);
    // Use the actual CSS timing, including reduced-motion overrides. The timer
    // also releases the lock when no transition runs (e.g. an already full panel).
    const style =
      panel && content.ownerDocument.defaultView?.getComputedStyle(panel);
    const milliseconds = (value: string) =>
      value
        .split(",")
        .map(
          (part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000),
        );
    const durations = milliseconds(style?.transitionDuration || "0s");
    const delays = milliseconds(style?.transitionDelay || "0s");
    const duration = Math.max(
      ...durations.map((value, i) => value + delays[i % delays.length]),
    );
    expand();
    timer = setTimeout(release, duration > 0 ? duration + 80 : 0);
  };
  const transitionEnd = (event: Event) => {
    if (
      event.target === panel &&
      (event as TransitionEvent).propertyName === "height"
    )
      release();
  };
  const scroll = () => {
    if (locked) content.scrollTop = initialScroll;
    else if (!expanded && content.scrollTop > initialScroll + 12) trigger();
  };
  const wheel = (event: WheelEvent) => {
    if (locked) return preventScroll(event);
    if (event.deltaY > 8 && Math.abs(event.deltaY) > Math.abs(event.deltaX))
      trigger(event);
  };
  const touchStart = (event: TouchEvent) => {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    start = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const touchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    if (locked) return preventScroll(event);
    if (!start) return;
    const touch = event.touches[0];
    const up = start.y - touch.clientY;
    if (up > 20 && up > Math.abs(touch.clientX - start.x)) trigger(event);
  };
  const touchEnd = () => {
    start = null;
  };
  content.addEventListener("scroll", scroll, { passive: true });
  content.addEventListener("wheel", wheel, { passive: false });
  content.addEventListener("touchstart", touchStart, { passive: true });
  content.addEventListener("touchmove", touchMove, { passive: false });
  content.addEventListener("touchend", touchEnd, { passive: true });
  content.addEventListener("touchcancel", touchEnd, { passive: true });
  panel?.addEventListener("transitionend", transitionEnd);
  panel?.addEventListener("transitioncancel", transitionEnd);
  return () => {
    release();
    content.removeEventListener("scroll", scroll);
    content.removeEventListener("wheel", wheel);
    content.removeEventListener("touchstart", touchStart);
    content.removeEventListener("touchmove", touchMove);
    content.removeEventListener("touchend", touchEnd);
    content.removeEventListener("touchcancel", touchEnd);
    panel?.removeEventListener("transitionend", transitionEnd);
    panel?.removeEventListener("transitioncancel", transitionEnd);
  };
}
