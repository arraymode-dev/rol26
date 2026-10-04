// Verified 4 October 2026: https://www.visitliverpool.com/river-of-light-2026/frequently-asked-questions/
// Opening is BST; closing is GMT, after the 25 October clock change.
export const EVENT_START = Date.parse("2026-10-23T17:00:00+01:00");
export const EVENT_END = Date.parse("2026-11-01T21:00:00+00:00");
export function eventCountdown(now: number) {
  const phase =
    now < EVENT_START ? "upcoming" : now < EVENT_END ? "during" : "ended";
  const minutes = Math.max(
    0,
    Math.ceil(((phase === "upcoming" ? EVENT_START : EVENT_END) - now) / 60000),
  );
  return {
    phase,
    days: Math.floor(minutes / 1440),
    hours: Math.floor(minutes / 60) % 24,
    minutes: minutes % 60,
  };
}

/** Only deliberate map movement dismisses the overview copy, not a tap or idle orbit. */
export function attachOverviewDismiss(
  canvas: EventTarget,
  dismiss: () => void,
) {
  const pointers = new Map<number, [number, number]>();
  let dismissed = false;
  const notify = () => {
    if (!dismissed) {
      dismissed = true;
      dismiss();
    }
  };
  const down = (e: Event) => {
    const p = e as PointerEvent;
    pointers.set(p.pointerId, [p.clientX, p.clientY]);
  };
  const move = (e: Event) => {
    const p = e as PointerEvent,
      start = pointers.get(p.pointerId);
    if (start && Math.hypot(p.clientX - start[0], p.clientY - start[1]) >= 4)
      notify();
  };
  const up = (e: Event) => pointers.delete((e as PointerEvent).pointerId);
  const wheel = (e: Event) => {
    const w = e as WheelEvent;
    if (w.deltaX || w.deltaY) notify();
  };
  const key = (e: Event) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "+",
        "=",
        "-",
      ].includes((e as KeyboardEvent).key)
    )
      notify();
  };
  const events: [string, EventListener][] = [
    ["pointerdown", down],
    ["pointermove", move],
    ["pointerup", up],
    ["pointercancel", up],
    ["lostpointercapture", up],
    ["wheel", wheel],
    ["keydown", key],
  ];
  for (const [name, listener] of events)
    canvas.addEventListener(name, listener, { capture: true, passive: true });
  return () => {
    for (const [name, listener] of events)
      canvas.removeEventListener(name, listener, true);
    pointers.clear();
  };
}
