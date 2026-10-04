import { useEffect, useState } from "react";
import { eventCountdown } from "../lib/event-countdown";

export function EventCountdown({ visible }: { visible: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const current = Date.now();
      setNow(current);
      timer = setTimeout(tick, 60000 - (current % 60000));
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const time = eventCountdown(now);
  return (
    <section
      className={`event-countdown${visible ? " is-visible" : ""}`}
      aria-label="River of Light countdown"
      aria-hidden={!visible}
    >
      <div className="countdown-eyebrow">
        <span />
        {time.phase === "upcoming"
          ? "A LITTLE LIGHT IS ON ITS WAY"
          : time.phase === "during"
            ? "THE FESTIVAL IS HERE"
            : "UNTIL NEXT TIME"}
      </div>
      <h2>
        {time.phase === "upcoming" ? (
          <>
            Together,
            <br />
            after dark.
          </>
        ) : time.phase === "during" ? (
          <>
            A city.
            <br />A little wonder.
          </>
        ) : (
          <>
            Thanks for
            <br />
            exploring.
          </>
        )}
      </h2>
      {time.phase !== "ended" && (
        <>
          <p className="countdown-caption">
            {time.phase === "upcoming"
              ? "The lights come on in"
              : "Time left to explore"}
          </p>
          <div
            className="countdown-digits"
            role="timer"
            aria-live="off"
            aria-label={`${time.days} days, ${time.hours} hours, ${time.minutes} minutes ${time.phase === "upcoming" ? "until the festival opens" : "until the festival ends"}`}
          >
            {[
              ["Days", time.days],
              ["Hours", time.hours],
              ["Mins", time.minutes],
            ].map(([label, value]) => (
              <div className="countdown-unit" key={label}>
                <span>{String(value).padStart(2, "0")}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="countdown-dates">
        23 Oct — 1 Nov 2026
        <br />
        <span>5–9 pm nightly · Free to explore</span>
      </p>
    </section>
  );
}
