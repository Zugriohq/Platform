import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import BrandWordmark from "./BrandWordmark.jsx";

export default function BrandIntro() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = "zugrio-brand-intro-v1";
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), reduced ? 520 : 1580);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="brand-intro"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? .2 : .42, ease: [0.16,1,0.3,1] }}
        >
          <div className="brand-intro-ridge" />
          <motion.div
            className="brand-intro-inner"
            initial={reduced ? false : { opacity: 0, scale: .985, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: .42, ease: [0.16,1,0.3,1] }}
          >
            <BrandWordmark variant="metallic" sweep={!reduced} decorative />
            <span>MARKET-AWARE TRADING INTELLIGENCE</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
