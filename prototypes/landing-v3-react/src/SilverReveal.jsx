import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
        <strong aria-hidden="true">ZUGRIO</strong>
      </div>
      <div className="silver-base" aria-hidden="true">ZUGRIO</div>
      <div className="silver-spotlight" aria-hidden="true">
        <div className="silver-word">ZUGRIO</div>
      </div>
      {!reduced && (
        <motion.div
          className="silver-sheen"
          aria-hidden="true"
          animate={{ x: ["-30%", "140%"] }}
          transition={{ duration: 7.5, repeat: Infinity, repeatDelay: 2.8, ease: [0.16,1,0.3,1] }}
        />
      )}
      <div className="silver-hint">Move through the field</div>
    </section>
  );
}
