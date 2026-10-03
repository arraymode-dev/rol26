/** Keep browser zoom separate from the map's own pointer/wheel camera controls. */
export function attachPageViewportGuard(target: EventTarget) {
  const prevent = (event: Event) => event.preventDefault();
  const wheel = (event: Event) => {
    if ((event as WheelEvent).ctrlKey) event.preventDefault();
  };
  const touch = (event: Event) => {
    if ((event as TouchEvent).touches.length > 1) event.preventDefault();
  };
  const key = (event: Event) => {
    const keyboard = event as KeyboardEvent;
    if (
      (keyboard.ctrlKey || keyboard.metaKey) &&
      ["+", "=", "-", "0"].includes(keyboard.key)
    )
      event.preventDefault();
  };
  const listeners: [string, EventListener][] = [
    ["gesturestart", prevent],
    ["gesturechange", prevent],
    ["touchmove", touch],
    ["wheel", wheel],
    ["keydown", key],
  ];
  for (const [type, listener] of listeners)
    target.addEventListener(type, listener, { capture: true, passive: false });
  // Do not stop propagation: the canvas must still receive map gestures.
  return () => {
    for (const [type, listener] of listeners)
      target.removeEventListener(type, listener, { capture: true });
  };
}
