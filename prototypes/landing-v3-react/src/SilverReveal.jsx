import React, { useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import BrandWordmark from "./BrandWordmark.jsx";

export default function SilverReveal() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [inside, setInside] = useState(false);

  function move(event) {
    const el = ref.current;
    if (!el || reduced) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", event.clientX - rect.left + "px");
    el.style.setProperty("--spot-y", event.clientY - rect.top + "px");
  }

  return (
    <section
      ref={ref}
      className={"silver-reveal " + (inside ? "is-active" : "")}
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => setInside(false)}
      onPointerMove={move}
      aria-label="Zugrio"
    >
      <div className="silver-grid" aria-hidden="true" />

      <div className="silver-copy">
        <span>THE CHART IS NOT THE MARKET.</span>
        <strong>DECISION INTEGRITY</strong>
      </div>

      <div className="silver-base" aria-hidden="true">
        <BrandWordmark variant="silver" decorative />
      </div>

      <div className="silver-spotlight" aria-hidden="true">
        <BrandWordmark variant="silver" decorative />
      </div>

      <div className="silver-hint">
        <span className="silver-hint-dot" aria-hidden="true" />
        Move through the field
      </div>
    </section>
  );
}
