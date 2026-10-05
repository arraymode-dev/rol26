/** One-shot intent detection. Passive listeners leave native inner scrolling intact. */
export function expandOnScroll(content: HTMLElement, expand: () => void) {
  let expanded = false;
  let start: { x: number; y: number } | null = null;
  const initialScroll = content.scrollTop;
  const trigger = () => {
    if (expanded) return;
    expanded = true;
    expand();
  };
  const scroll = () => {
    if (content.scrollTop > initialScroll + 12) trigger();
  };
  const wheel = (event: WheelEvent) => {
    if (event.deltaY > 8 && Math.abs(event.deltaY) > Math.abs(event.deltaX))
      trigger();
  };
  const touchStart = (event: TouchEvent) => {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    start = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const touchMove = (event: TouchEvent) => {
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const up = start.y - touch.clientY;
    if (up > 20 && up > Math.abs(touch.clientX - start.x)) trigger();
  };
  const touchEnd = () => {
    start = null;
  };
  content.addEventListener("scroll", scroll, { passive: true });
  content.addEventListener("wheel", wheel, { passive: true });
  content.addEventListener("touchstart", touchStart, { passive: true });
  content.addEventListener("touchmove", touchMove, { passive: true });
  content.addEventListener("touchend", touchEnd, { passive: true });
  content.addEventListener("touchcancel", touchEnd, { passive: true });
  return () => {
    content.removeEventListener("scroll", scroll);
    content.removeEventListener("wheel", wheel);
    content.removeEventListener("touchstart", touchStart);
    content.removeEventListener("touchmove", touchMove);
    content.removeEventListener("touchend", touchEnd);
    content.removeEventListener("touchcancel", touchEnd);
  };
}
