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
      className={"silver-reveal closing-signature " + (inside ? "is-active" : "")}
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => setInside(false)}
      onPointerMove={move}
      aria-labelledby="closing-thesis"
    >
      <div className="closing-field" aria-hidden="true">
        <div className="closing-field-line closing-field-line-a" />
        <div className="closing-field-line closing-field-line-b" />
        <div className="closing-field-light" />
      </div>

      <div className="silver-thesis closing-thesis">
        <div className="closing-overline">
          <span>THE ZUGRIO PRINCIPLE</span>
          <b>DECISION INTELLIGENCE / END TO END</b>
        </div>

        <h2 id="closing-thesis">
          The chart is not the market.
          <span>And the signal is not the whole decision.</span>
        </h2>

        <p>
          Zugrio follows the trade beyond the alert — from the conditions that formed it,
          through the decision to act, to what actually happened afterward.
        </p>
      </div>

      <div className="closing-mark" aria-hidden="true">
        <div className="silver-base">
          <BrandWordmark variant="silver" decorative />
        </div>
        <div className="silver-spotlight">
          <BrandWordmark variant="silver" decorative />
        </div>
      </div>

      <div className="silver-action closing-action">
        <a href="#early-access">
          Join early access
          <ArrowRight size={15}/>
        </a>

        <div className="closing-availability" aria-label="Zugrio current scope">
          <span>PRIVATE VALIDATION</span>
          <b aria-hidden="true" />
          <span>FX</span>
          <b aria-hidden="true" />
          <span>GOLD</span>
          <b aria-hidden="true" />
          <span>SYNTHETIC INDICES</span>
        </div>
      </div>
    </section>
  );
}
