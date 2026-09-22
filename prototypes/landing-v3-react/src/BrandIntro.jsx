import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import BrandWordmark from "./BrandWordmark.jsx";

export default function BrandIntro({ onComplete }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const overflowRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    overflowRef.current = root.style.overflow;
    root.style.overflow = "hidden";

    const timer = window.setTimeout(
      () => setVisible(false),
      reduced ? 520 : 2380
    );

    return () => {
      window.clearTimeout(timer);
      root.style.overflow = overflowRef.current || "";
    };
  }, [reduced]);

  function complete() {
    document.documentElement.style.overflow = overflowRef.current || "";
    onComplete?.();
  }

  return (
    <AnimatePresence onExitComplete={complete}>
      {visible && (
        <motion.div
          className="brand-intro"
          data-reduced={reduced ? "true" : "false"}
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? .22 : .52, ease: [0.16,1,0.3,1] }}
        >
          <div className="brand-intro-ambient" />
          <motion.div
            className="brand-intro-inner"
            initial={reduced ? false : { opacity: 0, scale: .986, filter: "blur(5px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: reduced ? .18 : .56, ease: [0.16,1,0.3,1] }}
          >
            <div className="brand-intro-stage">
              <BrandWordmark variant="metallic" className="brand-intro-wordmark" decorative eager />
              {!reduced && (
                <>
                  <span className="intro-light intro-light-soft" />
                  <span className="intro-light intro-light-primary" />
                  <span className="intro-glint intro-glint-z" />
                  <span className="intro-glint intro-glint-g" />
                  <span className="intro-glint intro-glint-r" />
                  <span className="intro-glint intro-glint-o" />
                </>
              )}
            </div>
            <motion.span
              className="brand-intro-descriptor"
              initial={reduced ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .5, delay: reduced ? 0 : .52 }}
            >
              MARKET-AWARE TRADING INTELLIGENCE
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
