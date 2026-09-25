import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, Check, ChevronRight, CircleAlert, LockKeyhole,
  Menu, X, Zap, Activity, Layers3, Radio
} from "lucide-react";
import CandlestickChart from "./CandlestickChart.jsx";
import Waitlist from "./Waitlist.jsx";
import SilverReveal from "./SilverReveal.jsx";
import BrandWordmark from "./BrandWordmark.jsx";
import BrandIntro from "./BrandIntro.jsx";
import MarketTopography from "./MarketTopography.jsx";
import CapabilityStatus from "./CapabilityStatus.jsx";

const MARKETS = {
  FX: {
    label: "EUR/USD",
    family: "FX",
    note: "London / New York overlap",
    status: "FX-specific checks",
    priceSpec: { base: 1.0782, unit: .0001, digits: 5 },
  },
  GOLD: {
    label: "Gold / USD",
    family: "Gold",
    note: "US session",
    status: "Gold-specific checks",
    priceSpec: { base: 2532, unit: 1.05, digits: 2 },
  },
  SYNTH: {
    label: "Jump 50",
    family: "Synthetic",
    note: "Synthetic specialist",
    status: "Synthetic-specific checks",
    priceSpec: { base: 96, unit: 1.18, digits: 2 },
  },
};

const CASES = {
  valid: {
    label: "Current entry qualifies",
    tone: "good",
    currentNorm: 61,
    rr: "1.88R",
    copy: "Strategy holds. Current conditions still qualify. The next action remains inside your selected control level.",
    action: "Prepared · Semi-Auto",
  },
  degraded: {
    label: "Entry no longer qualifies",
    tone: "warn",
    currentNorm: 84,
    rr: "0.67R",
    copy: "The signal stays on record. The current entry no longer qualifies.",
    action: "Pass · Reassess",
  },
};

const STORY = [
  {
    key: "market",
    overline: "MARKET",
    title: "Same setup. Different market. Different answer.",
    body: "The same chart pattern can mean something different in FX, Gold and Synthetic Indices. Zugrio evaluates it inside the market that produced it.",
  },
  {
    key: "method",
    overline: "STRATEGY",
    title: "Your strategy sets the rules. Zugrio keeps checking them.",
    body: "Choose Zugrio Core or another supported strategy. Zugrio keeps the rules consistent and the evidence limits visible.",
  },
  {
    key: "moment",
    overline: "CURRENT CONDITIONS",
    title: "A good setup can become a bad entry.",
    body: "Signals age. Price moves. Spread widens. Context changes. Zugrio keeps the original signal and rechecks what still makes sense now.",
  },
  {
    key: "mandate",
    overline: "CONTROL",
    title: "A signal is not the same as “trade now.”",
    body: "Triggered does not mean trade now. Zugrio checks current price, costs, account risk and your control level before the next action.",
  },
  {
    key: "memory",
    overline: "DECISION HISTORY",
    title: "See what happened — not just whether you won.",
    body: "Setup, changes, actions and outcome stay connected. Replay shows what was known then — not what hindsight says now.",
  },
];

const HERO_HEADLINES = [
  ["The market changes.", "Your decision should", "keep up."],
  ["Don’t trade the signal.", "Trade what’s still", "true."],
];

const PROBLEM_CHAIN = [
  ["01", "MISSED OPPORTUNITY", "You can miss the opportunity."],
  ["02", "STALE ENTRY", "You can find the right setup after the best entry has gone."],
  ["03", "CHANGING CONTEXT", "The market can change between the signal and the trade."],
  ["04", "PROCESS DEVIATION", "A good plan can break down in execution."],
  ["05", "EXECUTION MISMATCH", "Execution can differ from the plan."],
  ["06", "MISLEADING CONCLUSION", "After the position closes, P&L alone cannot tell you which part actually failed."],
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
  const frozenEntry = fmt(market.priceSpec, 60);
  const current = fmt(market.priceSpec, item.currentNorm);
  const displayPrice = current;

  return (
    <div className="product-shell" data-step={activeStep} aria-label="Illustrative Zugrio trading workspace">
      <div className="shell-top">
        <div className="shell-brand">
          <img className="shell-monogram" src="/brand/zugrio-monogram-silver.svg" alt="" aria-hidden="true" />
          <span>Trading workspace</span>
        </div>
        <div className="shell-health"><i /> 37s fresh</div>
        <div className="shell-account">DEMO-01 · SEMI-AUTO</div>
      </div>

      <div className="market-switcher" role="group" aria-label="Illustrative market">
        {Object.entries(MARKETS).map(([key, m]) => (
          <button key={key} className={marketKey === key ? "on" : ""} onClick={() => setMarketKey(key)}>
            <span>{m.family}</span><b>{m.label}</b>
          </button>
        ))}
        <div className="market-context-pill"><Radio size={12}/> illustrative stream</div>
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
              <strong>{displayPrice}</strong>
            </div>
          </div>

          <CandlestickChart
            marketKey={marketKey}
            caseKey={caseKey}
            priceSpec={market.priceSpec}
          />

          <div className="chart-foot">
            <span>{market.note}</span>
            <span>{market.status}</span>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-title">
            <span>Trade case</span><b>#{marketKey}-091</b>
          </div>

          <div className="scope-row method-row"><span>Strategy</span><b>Zugrio Core · preview</b></div>
          <div className="scope-row"><span>State</span><b>Signal recorded</b></div>
          <div className="scope-row context-row"><span>Context</span><b>{market.note}</b></div>

          <motion.div
            key={caseKey + marketKey}
            className={"now-card " + item.tone}
            initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: .38, ease: [0.16,1,0.3,1] }}
          >
            <div className="now-label">WHAT CHANGED</div>
            <strong>{item.label}</strong>
            <p>{item.copy}</p>
          </motion.div>

          <div className="evidence-strip" aria-label="Illustrative evidence">
            <span>Structure <b>holds</b></span>
            <span>Strategy <b>matched</b></span>
            <span>Entry <b>{caseKey === "valid" ? "current" : "degraded"}</b></span>
          </div>

          <div className="delta">
            <div><span>Signal entry</span><b>{frozenEntry}</b></div>
            <div><span>Current</span><b>{current}</b></div>
            <div><span>Gross R</span><b>{item.rr}</b></div>
          </div>

          <div className="mandate-line">
            <div><small>CONTROL LIMIT</small><b>{item.action}</b></div>
            <LockKeyhole size={16}/>
          </div>

          <div className="micro-thread" aria-label="Illustrative decision history">
            <span className="done">09:18 <b>qualified</b></span>
            <span className="done">09:24 <b>context checked</b></span>
            <span className={caseKey === "degraded" ? "attention" : "done"}>09:31 <b>{caseKey === "degraded" ? "entry changed" : "entry holds"}</b></span>
          </div>

          <div className="story-state">
            <span>{STORY.findIndex(x => x.key === activeStep) + 1}/5</span>
            <b>{STORY.find(x => x.key === activeStep)?.overline || "MARKET"}</b>
          </div>
        </aside>
      </div>

      <div className="shell-controls">
        <button className={caseKey === "valid" ? "on" : ""} onClick={() => setCaseKey("valid")}>Setup still holds</button>
        <button className={caseKey === "degraded" ? "on" : ""} onClick={() => setCaseKey("degraded")}>Entry deteriorates</button>
        <span>Illustrative trading scenario · not live trading</span>
      </div>
    </div>
  );
}

function Story({ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }) {
  return (
    <section className="story" id="how">
      <div className="story-wrap">
        <div className="story-visual">
          <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
        </div>
        <div className="story-copy">
          {STORY.map((s, index) => (
            <motion.article
              key={s.key}
              className={"story-step " + (activeStep === s.key ? "active" : "")}
              onViewportEnter={() => setActiveStep(s.key)}
              viewport={{ amount: .58, margin: "-8% 0px -22% 0px" }}
            >
              <div className="story-index">0{index + 1}</div>
              <div className="kicker">{s.overline}</div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.key === "market" && <em>Different markets deserve different intelligence.</em>}
              {s.key === "method" && <em>Your strategy and your level of automation are separate choices.</em>}
              {s.key === "mandate" && <em>Prepared ≠ submitted ≠ filled ≠ protected.</em>}
              {s.key === "memory" && <em>Hindsight doesn’t get to rewrite it.</em>}
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
  const [menu, setMenu] = useState(false);
  const [marketKey, setMarketKey] = useState("FX");
  const [caseKey, setCaseKey] = useState("valid");
  const [activeStep, setActiveStep] = useState("market");
  const [headlineIndex, setHeadlineIndex] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      setHeadlineIndex(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % HERO_HEADLINES.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [prefersReduced]);

  const nav = useMemo(() => [
    ["Product", "#product"],
    ["How it works", "#how"],
    ["Markets", "#markets"],
    ["Control", "#control"],
    ["Review", "#journal"],
    ["Readiness", "#status"],
  ], []);

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
        <nav className={menu ? "nav-links open" : "nav-links"}>
          {nav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        </nav>
        <a className="header-cta" href="#early-access">Join early access</a>
        <button className="menu" aria-label="Toggle menu" onClick={() => setMenu(v => !v)}>{menu ? <X/> : <Menu/>}</button>
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

            <h1 className="hero-headline" aria-label={HERO_HEADLINES[0].join(" ")}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={headlineIndex}
                  aria-hidden="true"
                  className="hero-headline-frame"
                  initial={prefersReduced ? false : { opacity: 0, y: 18, filter: "blur(7px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={prefersReduced ? undefined : { opacity: 0, y: -16, filter: "blur(6px)" }}
                  transition={{ duration: .78, ease: [0.16,1,0.3,1] }}
                >
                  {HERO_HEADLINES[headlineIndex].map((part, index) => (
                    <span className="hero-headline-part" key={part}>
                      {part}{index < HERO_HEADLINES[headlineIndex].length - 1 ? " " : ""}
                    </span>
                  ))}
                </motion.span>
              </AnimatePresence>
            </h1>

            <motion.p variants={{ hidden:{opacity:0,y:14},show:{opacity:1,y:0} }}>
              Zugrio scans FX, Gold and Synthetic Indices for opportunities that fit your strategy — then keeps checking the trade as price, costs, context and execution conditions change.
            </motion.p>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }} className="hero-actions">
              <a className="primary" href="#early-access">Join the early-access waitlist <ArrowRight size={17}/></a>
              <a className="secondary" href="#how">Explore the trading workspace <ChevronRight size={17}/></a>
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="hero-trust">
              Your capital stays with your broker. Joining or paying never gives Zugrio permission to trade your account — you grant that separately.
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="scope">
              FX <span/> Gold <span/> Synthetic Indices
            </motion.div>
            <motion.small variants={{ hidden:{opacity:0},show:{opacity:1} }}>
              Private validation. No public trading access yet. No performance claim.
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
              The signal alone is not enough to tell you whether the trade still makes sense, whether the plan was followed, or what actually failed.
            </p>
          </div>

          <div className="problem-chain" role="list" aria-label="Where trading decisions can break down">
            {PROBLEM_CHAIN.map(([index, label, copy], itemIndex) => (
              <motion.div
                className="problem-chain-row"
                role="listitem"
                key={label}
                initial={prefersReduced ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: .72 }}
                transition={{ duration: .52, delay: prefersReduced ? 0 : itemIndex * .045, ease: [0.16,1,0.3,1] }}
              >
                <span className="problem-index">{index}</span>
                <strong>{label}</strong>
                <p>{copy}</p>
              </motion.div>
            ))}
          </div>

          <p className="problem-close">
            Zugrio is built around the whole decision — before the signal, after it, and through review.
          </p>
        </motion.section>

        <Story {...{ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }} />

        <motion.section className="discipline" {...sectionReveal}>
          <div className="kicker">CONSISTENCY UNDER PRESSURE</div>
          <h2>Your rules don’t change because your mood did.</h2>
          <p>Zugrio keeps applying the same strategy through losses, long sessions and the temptation to chase. When your actions drift from the plan, the record shows it.</p>
          <strong>The market doesn’t change its standard because your mood did.</strong>
        </motion.section>

        <motion.section className="positive" id="control" {...sectionReveal}>
          <div className="positive-copy">
            <div className="kicker">AFTER A SIGNAL FIRES</div>
            <h2>The signal fired. The market kept moving.</h2>
            <p>Zugrio rechecks price, spread, account risk and your control level before the next step.</p>
          </div>
          <div className="progression">
            {["Signal fired","Price & costs rechecked","Entry still qualifies","Risk & control checked","Next step available"].map((x,i) => (
              <motion.div
                key={x}
                initial={{ opacity:0, x:20 }}
                whileInView={{ opacity:1, x:0 }}
                viewport={{ once:true, amount:.7 }}
                transition={{ duration:.52, delay:i*.05, ease:[0.16,1,0.3,1] }}
              >
                <span>{String(i+1).padStart(2,"0")}</span><b>{x}</b><Check size={15}/>
              </motion.div>
            ))}
            <small>Illustrative workflow only. Not a live trade, signal or performance result.</small>
          </div>
        </motion.section>

        <motion.section className="journal" id="journal" {...sectionReveal}>
          <div>
            <div className="kicker">BEHAVIORAL ANALYTICS</div>
            <h2>Your P&amp;L tells you what happened. Zugrio shows how you traded.</h2>
            <p>With read-only broker data, Zugrio spots patterns in how you trade — early entries, chased price, risk changes, early exits and overrides. System actions and your interventions stay separate.</p>
          </div>
          <motion.div
            className="record-card"
            initial={{ opacity:0, rotateX:8, y:24 }}
            whileInView={{ opacity:1, rotateX:0, y:0 }}
            viewport={{ once:true, amount:.4 }}
            transition={{ duration:.82, ease:[0.16,1,0.3,1] }}
          >
            <div><span>SYSTEM</span><b>PASS</b></div>
            <div><span>USER</span><b>OVERRIDE</b></div>
            <div><span>OUTCOME</span><b>PROFIT</b></div>
            <div><span>PROCESS</span><b className="warn-text">STRATEGY RULE BROKEN</b></div>
          </motion.div>
        </motion.section>

        <motion.section className="markets" id="markets" {...sectionReveal}>
          <div className="kicker">INITIAL MARKET SCOPE</div>
          <h2>Built first for FX, Gold and Synthetic Indices.</h2>
          <p>Zugrio treats FX, Gold and Synthetic Indices as separate market tracks. A strategy validated for one market is never assumed to work the same way in another.</p>
          <div className="market-cards">
            {[
              [Activity,"FX","Market/session/macro-aware"],
              [Layers3,"Gold","Separately scoped behavior and costs"],
              [Zap,"Synthetic Indices","Specialist family logic where validated"],
            ].map(([Icon,title,copy]) => (
              <motion.article key={title} whileHover={prefersReduced ? {} : { y:-6, scale:1.01 }} transition={{ duration:.22 }}>
                <Icon/><b>{title}</b><span>{copy}</span>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section className="status-board" id="status" {...sectionReveal}>
          <div className="status-copy">
            <div className="kicker">READINESS, WITHOUT GUESSWORK</div>
            <h2>Know what’s live.</h2>
            <p>Every market, broker connection and control mode carries a clear status.</p>
          </div>
          <div className="status-list">
            {[
              "strategy.zugrio_core",
              "mode.signal",
              "mode.semi_auto_ctrader",
              "mode.full_auto",
            ].map((capabilityId, i) => (
              <CapabilityStatus key={capabilityId} capabilityId={capabilityId} index={i} />
            ))}
            <small>Status is sourced from Zugrio&apos;s canonical capability manifest. Zugrio is currently in private validation.</small>
          </div>
        </motion.section>

        <motion.section className="education" {...sectionReveal}>
          <div className="education-icon"><CircleAlert/></div>
          <div><div className="kicker">YOUR STRATEGY, YOUR RULES</div><h2>Bring your own plan.</h2></div>
          <p>Record the setup, invalidation and risk before you act. Zugrio keeps the plan beside the outcome, even when it does not automate the strategy.</p>
        </motion.section>

        <motion.section className="why" {...sectionReveal}>
          <div className="kicker">WHY ZUGRIO EXISTS</div>
          <h2>Good rules get harder to follow in a live market.</h2>
          <p>After a loss or deep into a session, traders can enter early, chase price or abandon the plan. Zugrio stays useful before, during and after the trade — keeping strategy, setup, actions and outcome connected so you can see what really happened and improve.</p>
        </motion.section>

        <motion.section className="faq" {...sectionReveal}>
          <div className="kicker">QUESTIONS</div>
          <h2>What to know before joining.</h2>
          {[
            ["What can I use today?","The site is a product preview and waitlist. Zugrio remains in private validation; public trading access is not yet open."],
            ["Which markets are first?","FX, Gold and Synthetic Indices. Each is validated separately."],
            ["Does Zugrio use one trading strategy?","Zugrio Core is the default starting strategy under validation. Other supported strategies keep their own rules and market scope."],
            ["How does automation work?","Signal keeps execution with you. Semi-Auto, Auto and Full Auto add control only inside the rules, limits and permissions you choose."],
            ["What does behavioral analytics show?","With read-only broker data, Zugrio compares the plan with observable actions — timing, entry, risk changes, exits and overrides — without pretending to infer emotions."],
            ["Can I use my own discretionary plan?","Yes. Record the conditions, invalidation and risk, then review adherence even when Zugrio does not automate the strategy."],
            ["What happens when there is no setup?","No setup is a valid answer. Zugrio shows when nothing qualifies, evidence is stale, or a setup expires or invalidates."],
            ["Can I review a past decision?","Replay shows what was known at the time. Passed and missed cases stay reviewable, and strategy health stays separated by market and version."],
            ["How does desktop and mobile fit together?","Desktop is the fuller workspace. Mobile keeps alerts, the current case and the next step accessible. The same history follows you."],
            ["Does Zugrio guarantee profitable trades?","No. Zugrio improves consistency and decision review; it does not promise returns, win rate or profitable outcomes."],
            ["What happens after I join?","You’ll receive build updates and early-access invitations. Joining does not connect a broker or authorise trading."],
          ].map(([q,a]) => <details key={q}><summary>{q}<ChevronRight size={16}/></summary><p>{a}</p></details>)}
        </motion.section>

        <SilverReveal />
        <Waitlist />
      </main>

      <footer>
        <a className="brand" href="#top" aria-label="Zugrio home">
          <BrandWordmark variant="silver" className="footer-wordmark" decorative />
        </a>
        <p>Zugrio is in development and private validation. Product screens, prices and trading scenarios shown on this site may be illustrative. They are not investment recommendations, live signals or performance claims. Trading involves risk of loss.</p>
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
