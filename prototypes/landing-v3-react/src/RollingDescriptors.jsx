import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const PHRASES = [
  "strategy-aware market scanning",
  "FORMING → READY → TRIGGERED",
  "background opportunity alerts",
  "live chart reasoning",
  "your control stays explicit",
  "behavioral analytics",
  "decision replay",
];

export default function RollingDescriptors() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % PHRASES.length), 3200);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <div className="rolling-descriptor" aria-label="Zugrio product qualities">
      <span className="rolling-prefix">Built around</span>
      <span className="rolling-window">
        {reduced ? (
          <strong>{PHRASES[0]}</strong>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={PHRASES[index]}
              initial={{ y: 18, opacity: 0, filter: "blur(5px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -18, opacity: 0, filter: "blur(5px)" }}
              transition={{ duration: .52, ease: [0.16,1,0.3,1] }}
            >
              {PHRASES[index]}
            </motion.strong>
          </AnimatePresence>
        )}
      </span>
    </div>
  );
}
