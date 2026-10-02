import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, ChevronRight, LockKeyhole, Menu, X
} from "lucide-react";
import CandlestickChart from "./CandlestickChart.jsx";
import Waitlist from "./Waitlist.jsx";
import SilverReveal from "./SilverReveal.jsx";
import BrandWordmark from "./BrandWordmark.jsx";
import BrandIntro from "./BrandIntro.jsx";
import MarketTopography from "./MarketTopography.jsx";
import {
  ReadinessCapability,
  ReadinessMeta,
  ReadinessLegend,
} from "./CapabilityStatus.jsx";

const MARKETS = {
  FX: {
    label: "EUR/USD",
    family: "FX",
    note: "London / New York overlap",
    driver: "Economic events · session context",
    status: "FX-specific checks",
    priceSpec: { base: 1.0782, unit: .0001, digits: 5 },
  },
  GOLD: {
    label: "Gold / USD",
    family: "Gold",
    note: "US session",
    driver: "Macro events · session context",
    status: "Gold-specific checks",
    priceSpec: { base: 2532, unit: 1.05, digits: 2 },
  },
  SYNTH: {
    label: "Jump 50",
    family: "Synthetic",
    note: "Synthetic specialist",
    driver: "Generator-specific evidence",
    status: "Synthetic-specific checks",
    priceSpec: { base: 96, unit: 1.18, digits: 2 },
  },
};

const CASES = {
  valid: {
    label: "Current entry qualifies",
    tone: "holding",
    currentNorm: 61,
    rr: "1.88R",
    copy: "Strategy holds. Current conditions still qualify. The next action remains inside your selected control level.",
    action: "Prepared · Semi-Auto",
  },
  degraded: {
    label: "Entry no longer qualifies",
    tone: "caution",
    currentNorm: 84,
    rr: "0.67R",
    copy: "The signal stays on record. The current entry no longer qualifies.",
    action: "Stand aside · Reassess",
  },
};

const STORY = [
  {
    key: "market",
    overline: "MARKET",
    title: "Same pattern. Different market. Different answer.",
    body: "Zugrio does not treat FX, Gold and Synthetic Indices as interchangeable price charts. It evaluates the opportunity inside the market and instrument that produced it — including the behaviour, costs and context that actually apply there.",
    proof: "Similar candles do not automatically deserve the same conclusion.",
  },
  {
    key: "strategy",
    overline: "STRATEGY",
    title: "Your strategy decides what counts.",
    body: "The same market can produce different answers under different strategies. Zugrio uses your strategy to decide what qualifies as a setup, which price areas matter, what must confirm the entry and what invalidates the trade.",
    proof: "No setup is a valid answer too.",
  },
  {
    key: "current",
    overline: "CURRENT CONDITIONS",
    title: "A valid signal can become a poor entry.",
    body: "The original signal stays on record. Zugrio separately rechecks the trade available now as price, costs, freshness, entry geometry and relevant context change.",
    proof: "What qualified then is not automatically what qualifies now.",
  },
  {
    key: "control",
    overline: "CONTROL",
    title: "A signal is not permission.",
    body: "Finding an opportunity, approving a trade and allowing software to act are different decisions. You choose how much execution authority to delegate.",
    proof: "More automation should never mean less clarity about who is allowed to act.",
  },
  {
    key: "history",
    overline: "DECISION HISTORY",
    title: "Hindsight doesn’t get to rewrite the trade.",
    body: "Zugrio keeps the original trade available for review: the strategy state, relevant evidence, what changed, the intended action, what you or the system did, what the broker actually did and what happened afterward.",
    proof: "Replay shows what was knowable at the time.",
  },
];

const HERO_HEADLINES = [
  ["Don’t trade the signal.", "Trade what’s still true."],
  ["Markets change.", "Your decision should too."],
];

const PROBLEM_CHAIN = [
  ["01", "MISSED OPPORTUNITY", "A valid setup forms while your attention is elsewhere, so the trade is never considered."],
  ["02", "STALE ENTRY", "The setup was valid, but price has moved far enough that the original entry geometry no longer holds."],
  ["03", "CHANGING CONTEXT", "Session, spread, volatility or market structure changes after the signal and changes the decision."],
  ["04", "PROCESS DEVIATION", "The idea survives, but size, timing, confirmation or risk is changed outside the plan."],
  ["05", "EXECUTION MISMATCH", "The fill, stop, protection or submitted order differs from what was actually approved."],
  ["06", "MISLEADING CONCLUSION", "A win can hide a broken process; a loss can still come from a sound, compliant decision."],
];

const FAQ_ITEMS = [
  {
    code: "ACCESS",
    question: "What can I use today?",
    answer: "Zugrio is in private validation. The first release starts invite-only on Windows desktop, with Zugrio Core, Signal and Semi-Auto on cTrader. Public trading access is not open yet.",
  },
  {
    code: "MARKETS",
    question: "Which markets is Zugrio built around first?",
    answer: "FX, Gold and Synthetic Indices. Each market and instrument scope is evaluated separately rather than inheriting assumptions from another market.",
  },
  {
    code: "STRATEGY",
    question: "Which strategies will Zugrio support?",
    answer: "Zugrio supports a wider strategy direction that includes Zugrio Core, Smart Money Concepts, Trend Following, Range / Mean Reversion and Custom Strategy.",
  },
  {
    code: "AI",
    question: "Does AI decide the trade?",
    answer: "AI may help explain structured product state. Authoritative strategy state, chart annotations, risk rules and trading permissions come from defined, versioned system logic and evidence.",
  },
  {
    code: "CONTROL",
    question: "How does automation work?",
    answer: "Zugrio separates analysis from permission. Signal keeps execution with you. Semi-Auto acts only after you approve. Auto and Full Auto add deeper delegation within limits you set, with their current availability shown here.",
  },
  {
    code: "BROKER",
    question: "Which broker comes first for Semi-Auto?",
    answer: "cTrader is the first Semi-Auto broker path planned for the first release. Its current availability is shown here.",
  },
  {
    code: "CLIENTS",
    question: "Where will I use Zugrio?",
    answer: "The first release is Windows-desktop first, with web for account and access workflows. Mobile follows later.",
  },
  {
    code: "CUSTOM",
    question: "Can I use my own strategy?",
    answer: "Custom Strategy is part of the broader Zugrio direction, but it is not part of the first release.",
  },
  {
    code: "NO TRADE",
    question: "What happens when nothing qualifies?",
    answer: "Zugrio can return No trade. Standing aside is a valid decision.",
  },
  {
    code: "REPLAY",
    question: "Can I review a trade afterward?",
    answer: "Decision history and replay preserve what was known at the time and what happened afterward. Current availability is shown here.",
  },
  {
    code: "CUSTODY",
    question: "Does Zugrio hold my money?",
    answer: "No. Capital remains with the broker. Custody, product access and permission to submit a trade are separate.",
  },
  {
    code: "RISK",
    question: "Does Zugrio guarantee profitable trades?",
    answer: "No. Markets are uncertain. Zugrio does not guarantee returns, win rates or profitable outcomes.",
  },
  {
    code: "EARLY ACCESS",
    question: "What happens after I join early access?",
    answer: "You will receive meaningful build updates and invitations as eligible capabilities and scopes open. Joining does not connect a broker or authorise trading.",
  },
];

const sectionReveal = {
  initial: { opacity: 0, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: .18 },
  transition: { duration: .88, ease: [0.16, 1, 0.3, 1] },
};

function fmt(priceSpec, value) {
  return (priceSpec.base + value * priceSpec.unit).toFixed(priceSpec.digits);
}

function Shell({ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }) {
  const market = MARKETS[marketKey];
  const item = CASES[caseKey];
  const step = STORY.find((entry) => entry.key === activeStep) || STORY[0];
  const stepIndex = STORY.findIndex((entry) => entry.key === activeStep);
  const frozenEntry = fmt(market.priceSpec, 60);
  const current = fmt(market.priceSpec, item.currentNorm);
  const entryStillHolds = caseKey === "valid";

  return (
    <div className="product-shell" data-step={activeStep} aria-label="Illustrative Zugrio trading workspace">
      <div className="shell-top">
        <div className="shell-brand">
          <img className="shell-monogram" src="/brand/zugrio-monogram-silver.svg" alt="" aria-hidden="true" />
          <span>Trading workspace</span>
        </div>
        <div className="shell-freshness"><span>FRESHNESS</span><b>37s</b></div>
        <div className="shell-account">DEMO-01 · SEMI-AUTO</div>
      </div>

      <div className="market-switcher" role="group" aria-label="Illustrative market">
        {Object.entries(MARKETS).map(([key, m]) => (
          <button key={key} className={marketKey === key ? "on" : ""} onClick={() => setMarketKey(key)}>
            <span>{m.family}</span><b>{m.label}</b>
          </button>
        ))}
        <div className="market-context-line"><span>CONTEXT</span><b>ILLUSTRATIVE</b></div>
      </div>

      <div className="case-grid">
        <div className="chart-panel">
          <div className="chart-head">
            <div>
              <small>{market.family} · M15</small>
              <h3>{market.label}</h3>
            </div>
            <div className="live-price">
              <small>Illustrative price</small>
              <strong>{current}</strong>
            </div>
          </div>

          <CandlestickChart marketKey={marketKey} caseKey={caseKey} priceSpec={market.priceSpec} />

          <div className="chart-foot">
            <span>{market.note}</span>
            <span>{market.status}</span>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-title">
            <span>DECISION CASE</span><b>#{marketKey}-091</b>
          </div>

          <div className="decision-identity">
            <div><span>STRATEGY</span><b>Zugrio Core · preview</b></div>
            <div><span>SIGNAL</span><b>Recorded · 09:24</b></div>
            <div><span>MARKET</span><b>{market.family}</b></div>
          </div>

          <motion.div
            key={caseKey + marketKey}
            className={"decision-summary " + (entryStillHolds ? "holding" : "caution")}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: .34, ease: [0.16,1,0.3,1] }}
          >
            <span>CURRENT DECISION</span>
            <strong>{entryStillHolds ? "Entry still qualifies" : "Stand aside — entry degraded"}</strong>
            <p>{item.copy}</p>
          </motion.div>

          <div className="decision-metrics" aria-label="Illustrative decision evidence">
            <div><span>STRUCTURE</span><b>Holds</b></div>
            <div><span>ENTRY</span><b>{entryStillHolds ? "Current" : "Degraded"}</b></div>
            <div><span>R:R NOW</span><b>{item.rr}</b></div>
          </div>

          <div className="decision-delta">
            <div><span>SIGNAL ENTRY</span><b>{frozenEntry}</b></div>
            <i aria-hidden="true">→</i>
            <div><span>CURRENT</span><b>{current}</b></div>
          </div>

          <div className="decision-next">
            <div><span>NEXT ACTION</span><b>{entryStillHolds ? "Prepared · Semi-Auto" : "Stand aside · Reassess"}</b></div>
            <LockKeyhole size={16} aria-hidden="true" />
          </div>

          <div className="story-state">
            <span>0{stepIndex + 1} / 05</span>
            <b>{step.overline}</b>
          </div>
        </aside>
      </div>

      <div className="shell-controls">
        <span className="scenario-label">ILLUSTRATIVE CASE</span>
        <button className={caseKey === "valid" ? "on" : ""} onClick={() => setCaseKey("valid")}>ENTRY HOLDS</button>
        <button className={caseKey === "degraded" ? "on" : ""} onClick={() => setCaseKey("degraded")}>ENTRY DEGRADES</button>
        <span className="scenario-note">Not live trading</span>
      </div>
    </div>
  );
}

function Story({ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }) {
  const activateStep = (key) => {
    setActiveStep(key);
    setCaseKey(["current", "control", "history"].includes(key) ? "degraded" : "valid");
  };

  return (
    <section className="story" id="how">
      <div className="story-section-head">
        <span>ONE DECISION / FIVE LAYERS</span>
        <div className="story-pathline" aria-label="Market, Strategy, Current Conditions, Control, Decision History">
          {STORY.map((step, index) => (
            <React.Fragment key={step.key}>
              <b className={activeStep === step.key ? "active" : ""}>{step.overline}</b>
              {index < STORY.length - 1 && <i aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="story-wrap">
        <div className="story-visual">
          <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
        </div>

        <div className="story-copy">
          {STORY.map((s, index) => (
            <motion.article
              key={s.key}
              className={"story-step " + (activeStep === s.key ? "active" : "")}
              onViewportEnter={() => activateStep(s.key)}
              viewport={{ amount: .56, margin: "-8% 0px -22% 0px" }}
            >
              <div className="story-index">0{index + 1}</div>
              <div className="kicker">{s.overline}</div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>

              <div className="story-proof"><span>{s.proof}</span></div>

            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, .12], [0.9, 1]);
  const heroRotate = useTransform(scrollYProgress, [0, .12], [prefersReduced ? 0 : 1.1, 0]);
  const heroY = useTransform(scrollYProgress, [0, .12], [prefersReduced ? 0 : 58, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, .14], [1, .96]);

  const [introComplete, setIntroComplete] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [menu, setMenu] = useState(false);
  const [marketKey, setMarketKey] = useState("FX");
  const [caseKey, setCaseKey] = useState("valid");
  const [activeStep, setActiveStep] = useState("market");
  const [faqIndex, setFaqIndex] = useState(0);

  const nav = useMemo(() => [
    ["Product", "#product"],
    ["How it works", "#how"],
    ["Decision quality", "#decision-quality"],
    ["Readiness", "#status"],
  ], []);

  useEffect(() => {
    if (!introComplete) return undefined;

    const timer = window.setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % HERO_HEADLINES.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [introComplete]);

  return (
    <>
      <BrandIntro onComplete={() => setIntroComplete(true)} />
      <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Zugrio home">
          <BrandWordmark variant="silver" className="header-wordmark" decorative eager />
        </a>
        <nav id="primary-navigation" className={menu ? "nav-links open" : "nav-links"}>
          {nav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        </nav>
        <a className="header-cta" href="#early-access">Join early access</a>
        <button className="menu" aria-label="Toggle menu" aria-expanded={menu} aria-controls="primary-navigation" onClick={() => setMenu(v => !v)}>{menu ? <X/> : <Menu/>}</button>
      </header>

      <main id="top">
        <section className="hero" id="product">
          <MarketTopography />
          <motion.div
            initial={prefersReduced ? false : "hidden"}
            animate={prefersReduced || introComplete ? "show" : "hidden"}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: .09, delayChildren: .12 } }
            }}
            className="hero-copy"
          >
            <motion.div variants={{ hidden:{opacity:0,y:10},show:{opacity:1,y:0} }} className="eyebrow">
              <span>MARKET-AWARE TRADING INTELLIGENCE</span>
            </motion.div>

            <motion.h1
              className="hero-headline"
              aria-label={HERO_HEADLINES[headlineIndex].join(" ")}
              variants={{ hidden:{opacity:0,y:18,filter:"blur(7px)"},show:{opacity:1,y:0,filter:"blur(0px)"} }}
              transition={{ duration: .78, ease: [0.16,1,0.3,1] }}
            >
              <span className="hero-headline-window">
                {HERO_HEADLINES.map((headline, index) => {
                  const active = index === headlineIndex;
                  return (
                    <motion.span
                      key={headline.join("|")}
                      className={"hero-headline-frame " + (active ? "is-active" : "is-inactive")}
                      aria-hidden="true"
                      initial={false}
                      animate={{
                        opacity: active ? 1 : 0,
                        y: prefersReduced ? 0 : active ? "0%" : index < headlineIndex ? "-28%" : "28%",
                        filter: prefersReduced || active ? "blur(0px)" : "blur(5px)",
                      }}
                      transition={{ duration: prefersReduced ? 0 : .68, ease: [0.16,1,0.3,1] }}
                    >
                      {headline.map((part) => (
                        <span className="hero-headline-part" key={part}>{part}</span>
                      ))}
                    </motion.span>
                  );
                })}
              </span>
            </motion.h1>

            <motion.p variants={{ hidden:{opacity:0,y:14},show:{opacity:1,y:0} }}>
              Zugrio finds setups for your strategy, reads each one in the market it comes from, and rechecks the entry until you act — within your limits, on the record.
            </motion.p>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }} className="hero-actions">
              <a className="primary" href="#early-access">Join early access <ArrowRight size={17}/></a>
              <a className="secondary" href="#how">See how Zugrio works <ChevronRight size={17}/></a>
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="hero-trust">
              Your capital stays with your broker. You decide how much Zugrio may do, from alerts only to trading within the limits you set.
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="scope">
              <b>Starting with</b> FX <span/> Gold <span/> Synthetic Indices
            </motion.div>
            <motion.small variants={{ hidden:{opacity:0},show:{opacity:1} }}>
              Private validation · No public trading access or performance claims yet.
            </motion.small>
          </motion.div>

          <motion.div className="hero-product" style={{ scale: heroScale, rotateX: heroRotate, y: heroY, opacity: heroOpacity }}>
            <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
          </motion.div>
        </section>

        <motion.section className="problem" id="problem" {...sectionReveal}>
          <div className="problem-intro">
            <div className="kicker">THE SIGNAL ISN’T THE WHOLE TRADE</div>
            <h2>Trading breaks in more than one place.</h2>
            <p>
              A setup can be valid and the final decision can still degrade later. Zugrio follows the whole chain so you can see where the decision actually changed.
            </p>
          </div>

          <div className="problem-rail" role="list" aria-label="Six places a trading decision can break">
            {PROBLEM_CHAIN.map(([index, label, copy], itemIndex) => (
              <motion.article
                className="problem-node"
                role="listitem"
                key={label}
                initial={prefersReduced ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: .65 }}
                transition={{ duration: .5, delay: prefersReduced ? 0 : itemIndex * .055, ease: [0.16,1,0.3,1] }}
              >
                <div className="problem-node-marker">
                  <span>{index}</span><i aria-hidden="true" />
                </div>
                <strong>{label}</strong>
                <p>{copy}</p>
              </motion.article>
            ))}
          </div>

          <p className="problem-close">
            One signal. Six failure points. The outcome alone cannot tell you which one mattered.
          </p>
        </motion.section>

        <Story {...{ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }} />

        <motion.section className="decision-quality" id="decision-quality" {...sectionReveal}>
          <div className="dq-intro">
            <div className="kicker">NOT ONE SCORE</div>
            <h2>P&amp;L is the result. Not the diagnosis.</h2>
            <p>Zugrio separates strategy quality, process, execution and outcome so you can see what actually needs fixing.</p>
          </div>

          <div className="dq-audit" aria-label="Illustrative four-part decision audit">
            <div className="dq-audit-head">
              <span>ILLUSTRATIVE DECISION AUDIT</span>
              <b>ONE TRADE / FOUR VERDICTS</b>
            </div>

            <div className="dq-axis-stack">
              <div className="dq-axis">
                <span className="dq-axis-index">01</span>
                <div>
                  <strong>STRATEGY HEALTH</strong>
                  <p>Is there real evidence behind this strategy in this market?</p>
                </div>
                <b className="dq-verdict neutral">EVIDENCE · MODERATE</b>
              </div>

              <div className="dq-axis">
                <span className="dq-axis-index">02</span>
                <div>
                  <strong>PROCESS</strong>
                  <p>Did you follow the strategy, plan, risk and approval process?</p>
                </div>
                <b className="dq-verdict adverse">RULE VIOLATION</b>
              </div>

              <div className="dq-axis">
                <span className="dq-axis-index">03</span>
                <div>
                  <strong>EXECUTION</strong>
                  <p>Did the real order, fill and protection match what you approved?</p>
                </div>
                <b className="dq-verdict neutral">FILLED AS SENT</b>
              </div>

              <div className="dq-axis">
                <span className="dq-axis-index">04</span>
                <div>
                  <strong>OUTCOME</strong>
                  <p>What happened financially?</p>
                </div>
                <b className="dq-verdict outcome">PROFIT</b>
              </div>
            </div>

            <div className="dq-case-ledger">
              <div><span>SYSTEM DECISION</span><b>NO TRADE</b></div>
              <i aria-hidden="true" />
              <div><span>YOUR ACTION</span><b>OVERRIDE</b></div>
              <i aria-hidden="true" />
              <div><span>OUTCOME</span><b>PROFIT</b></div>
              <i aria-hidden="true" />
              <div><span>PROCESS</span><b className="adverse-text">RULE VIOLATION</b></div>
            </div>

            <div className="dq-rule">
              <strong>A winning violation remains a violation.</strong>
              <span>A compliant loss does not automatically mean the process failed.</span>
            </div>
          </div>

          <div className="dq-behaviour">
            <div className="dq-layer-copy">
              <div className="kicker">BEHAVIOUR HEALTH</div>
              <h3>Observe the action. Don’t invent the emotion.</h3>
              <p>Where supported by broker data, Zugrio can surface observable deviations such as entering early, chasing price, changing risk, exiting early or overriding the system state.</p>
            </div>

            <div className="dq-observation-ledger" aria-label="Examples of factual behaviour observations">
              {[
                ["01","EARLY ENTRY"],
                ["02","CHASED PRICE"],
                ["03","RISK CHANGE"],
                ["04","EARLY EXIT"],
                ["05","OVERRIDE"],
              ].map(([index,label]) => (
                <div key={label}><span>{index}</span><b>{label}</b></div>
              ))}
              <small>Evidence-backed observations only · no emotion inference</small>
            </div>
          </div>

          <div className="dq-guardrails">
            <div className="dq-guardrail-copy">
              <div className="kicker">GUARDRAILS</div>
              <h3>Make the rule visible before the moment tests it.</h3>
              <p>Set your own guardrails. Zugrio can flag a broken rule, ask you to confirm, or enforce it — while safe risk reduction always remains available.</p>
            </div>

            <div className="dq-guardrail-rail" aria-label="How guardrails can progress">
              <div className="dq-guardrail-step"><span>01</span><b>Flag the broken rule</b></div>
              <span className="dq-guardrail-line" aria-hidden="true" />
              <div className="dq-guardrail-step"><span>02</span><b>Ask for confirmation</b></div>
              <span className="dq-guardrail-line" aria-hidden="true" />
              <div className="dq-guardrail-step"><span>03</span><b>Enforce the chosen limit</b></div>
            </div>
          </div>

          <div className="dq-close" role="note">
            <span>DECISION QUALITY / THE POINT</span>
            <strong>Know what actually needs improving.</strong>
          </div>
        </motion.section>

        <motion.section className="readiness" id="status" {...sectionReveal}>
          <div className="readiness-intro">
            <div>
              <div className="kicker">READINESS, WITHOUT GUESSWORK</div>
              <h2>Know what’s live. And what isn’t.</h2>
            </div>
            <div>
              <p>Some of this is coming soon. Most isn’t available yet. Here’s exactly what is in validation, planned, or deliberately locked.</p>
              <ReadinessMeta />
            </div>
          </div>

          <div className="readiness-console" aria-label="Zugrio capability readiness">
            <div className="readiness-console-head">
              <span>CAPABILITY READINESS</span>
              <b>CURRENT BUILD STATUS</b>
            </div>

            <div className="readiness-group">
              <div className="readiness-group-title"><span>01</span><b>CORE DECISION</b></div>
              <div className="readiness-grid">
                {[
                  "strategy.zugrio_core",
                  "intelligence.market_drivers",
                  "intelligence.current_entry_recheck",
                  "chart.annotations",
                  "decision.replay",
                  "intelligence.strategy_health",
                  "behaviour.observations",
                ].map((capabilityId) => (
                  <ReadinessCapability key={capabilityId} capabilityId={capabilityId} />
                ))}
              </div>
            </div>

            <div className="readiness-group">
              <div className="readiness-group-title"><span>02</span><b>CONTROL</b></div>
              <div className="readiness-grid">
                {[
                  "mode.signal",
                  "mode.semi_auto_ctrader",
                  "mode.auto",
                  "mode.full_auto",
                ].map((capabilityId) => (
                  <ReadinessCapability key={capabilityId} capabilityId={capabilityId} />
                ))}
              </div>
            </div>

            <div className="readiness-group">
              <div className="readiness-group-title"><span>03</span><b>CLIENTS</b></div>
              <div className="readiness-grid">
                {[
                  "client.windows_desktop",
                  "client.web",
                  "client.mobile",
                ].map((capabilityId) => (
                  <ReadinessCapability key={capabilityId} capabilityId={capabilityId} />
                ))}
              </div>
            </div>
          </div>

          <div className="readiness-meaning">
            <div>
              <div className="kicker">STATUS LANGUAGE</div>
              <h3>One label should answer one question: can I use this now?</h3>
              <p>These labels describe availability only. They are not claims about performance, profitability or product quality.</p>
            </div>
            <ReadinessLegend />
          </div>
        </motion.section>

        <motion.section className="trust-faq" id="faq" {...sectionReveal}>
          <div className="trust-faq-head">
            <div className="kicker">QUESTIONS / TRUST</div>
            <h2>What to know before joining.</h2>
          </div>

          <div className="trust-dossier">
            <div className="trust-index" aria-label="Zugrio questions">
              {FAQ_ITEMS.map((item, index) => (
                <button
                  type="button"
                  aria-pressed={faqIndex === index}
                  className={faqIndex === index ? "active" : ""}
                  onClick={() => setFaqIndex(index)}
                  key={item.question}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item.question}</b>
                  <em>{item.code}</em>
                </button>
              ))}
            </div>

            <div className="trust-answer-wrap">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  className="trust-answer"
                  key={faqIndex}
                  aria-live="polite"
                  initial={{ opacity: 0, y: 12, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: .34, ease: [0.16,1,0.3,1] }}
                >
                  <div className="trust-answer-meta">
                    <span>{String(faqIndex + 1).padStart(2, "0")} / {String(FAQ_ITEMS.length).padStart(2, "0")}</span>
                    <b>{FAQ_ITEMS[faqIndex].code}</b>
                  </div>

                  <h3>{FAQ_ITEMS[faqIndex].question}</h3>
                  <p>{FAQ_ITEMS[faqIndex].answer}</p>

                </motion.article>
              </AnimatePresence>

              <div className="trust-principle">
                <span>TRUST PRINCIPLE</span>
                <b>Access, custody and trading authority remain separate.</b>
              </div>
            </div>
          </div>
        </motion.section>

        <SilverReveal />
        <Waitlist />
      </main>

      <footer>
        <a className="brand" href="#top" aria-label="Zugrio home">
          <BrandWordmark variant="silver" className="footer-wordmark" decorative />
        </a>
        <p>Zugrio is in development and private validation. Product screens, prices, trade cases and readiness examples may be illustrative unless stated otherwise. They are not investment recommendations, live signals or performance claims. Trading involves risk of loss.</p>
        <div>
          <a href="#status">Product status</a>
          <a href="#early-access">Early access</a>
          <a href="https://www.instagram.com/zugriohq/" target="_blank" rel="noreferrer">Instagram · @zugriohq</a>
          <a href="#top">Back to top</a>
        </div>
      </footer>
    </>
  );
}
