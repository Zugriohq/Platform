import React, { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
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
      aria-labelledby="closing-thesis"
    >
      <div className="silver-grid" aria-hidden="true" />

      <div className="silver-thesis">
        <span>THE ZUGRIO PRINCIPLE</span>
        <h2 id="closing-thesis">The chart is not the market.</h2>
        <strong>And the signal is not the whole decision.</strong>
        <p>Zugrio follows the trade beyond the alert — from the first setup to the final review.</p>
      </div>

      <div className="silver-base" aria-hidden="true">
        <BrandWordmark variant="silver" decorative />
      </div>

      <div className="silver-spotlight" aria-hidden="true">
        <BrandWordmark variant="silver" decorative />
      </div>

      <div className="silver-action">
        <a href="#early-access">Join early access <ArrowRight size={15}/></a>
        <div className="silver-scope">
          <span>PRIVATE VALIDATION</span>
          <i aria-hidden="true" />
          <span>FX</span>
          <i aria-hidden="true" />
          <span>GOLD</span>
          <i aria-hidden="true" />
          <span>SYNTHETIC INDICES</span>
        </div>
      </div>

      {!reduced && (
        <div className="silver-hint">
          <span>MOVE THROUGH THE FIELD</span>
          <i aria-hidden="true" />
          <b>REVEAL ZUGRIO</b>
        </div>
      )}
    </section>
  );
}
