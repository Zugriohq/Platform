import React, { useMemo, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, Check, ChevronRight, CircleAlert, LockKeyhole,
  Menu, X, Zap, Activity, Layers3, Radio
} from "lucide-react";
import CandlestickChart from "./CandlestickChart.jsx";
import RollingDescriptors from "./RollingDescriptors.jsx";
import Waitlist from "./Waitlist.jsx";
import SilverReveal from "./SilverReveal.jsx";

const MARKETS = {
  FX: {
    label: "EUR/USD",
    family: "FX",
    note: "London / New York overlap",
    status: "Market-specific evaluation",
    priceSpec: { base: 1.0782, unit: .0001, digits: 5 },
  },
  GOLD: {
    label: "Gold / USD",
    family: "Gold",
    note: "US session",
    status: "Separately scoped intelligence",
    priceSpec: { base: 2532, unit: 1.05, digits: 2 },
  },
  SYNTH: {
    label: "Jump 50",
    family: "Synthetic",
    note: "Synthetic specialist",
    status: "Family-specific evaluation",
    priceSpec: { base: 96, unit: 1.18, digits: 2 },
  },
};

const CASES = {
  valid: {
    label: "Current entry qualifies",
    tone: "good",
    currentNorm: 61,
    rr: "1.88R",
    copy: "The method still qualifies, current conditions remain acceptable and the prepared intent is waiting for approval.",
    action: "Prepared · Semi-Auto",
  },
  degraded: {
    label: "Entry no longer qualifies",
    tone: "warn",
    currentNorm: 84,
    rr: "0.67R",
    copy: "The original signal remains recorded, but current entry economics have deteriorated. The old entry is not silently relabelled as current.",
    action: "Pass · Reassess",
  },
};

const STORY = [
  {
    key: "market",
    overline: "MARKET",
    title: "Same pattern. Different market. Different answer.",
    body: "A structure break can look similar in FX, Gold and a Synthetic Index and still mean something different. Zugrio evaluates the opportunity inside the market family that produced it instead of forcing every instrument through one generic model.",
  },
  {
    key: "method",
    overline: "METHOD",
    title: "Your method sets the rules. Zugrio doesn’t silently bend them.",
    body: "Choose the framework you trade — structure and liquidity, smart-money concepts, or your own price-action rules. Zugrio keeps applying that standard without quietly changing it because the session is slow, the last trade lost or you have been watching too long.",
  },
  {
    key: "moment",
    overline: "CURRENT CONDITIONS",
    title: "If the facts change, the trade changes.",
    body: "A setup does not exist in isolation. Price, spread, entry economics, session, volatility, market regime and account state can change what still qualifies after the original opportunity appears.",
  },
  {
    key: "mandate",
    overline: "CONTROL",
    title: "A signal is not permission.",
    body: "Your methodology determines how an opportunity is evaluated. Your automation setting determines what Zugrio is allowed to do about it. Market intelligence, account risk, execution authority and broker reality remain separate.",
  },
  {
    key: "memory",
    overline: "DECISION HISTORY",
    title: "The reason stays with the trade.",
    body: "Entered, passed, blocked, expired, missed or overridden — the case stays in the record. Outcome and process remain separate so hindsight cannot quietly rewrite what was known at the time.",
  },
];

const TICKER = [
  "Market-specific intelligence",
  "Method-bound evaluation",
  "Current-condition checks",
  "Mandate before action",
  "Decision integrity preserved",
  "FX · Gold · Synthetic Indices",
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

function SignalTicker() {
  const doubled = [...TICKER, ...TICKER];
  return (
    <div className="signal-ticker" aria-label="Zugrio product descriptors">
      <div className="signal-ticker-track">
        {doubled.map((text, i) => (
          <span key={text + i}><i /> {text}</span>
        ))}
      </div>
    </div>
  );
}

function Shell({ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }) {
  const market = MARKETS[marketKey];
  const item = CASES[caseKey];
  const frozenEntry = fmt(market.priceSpec, 60);
  const current = fmt(market.priceSpec, item.currentNorm);
  const displayPrice = current;

  return (
    <div className="product-shell" data-step={activeStep} aria-label="Illustrative Zugrio decision workspace">
      <div className="shell-top">
        <div className="shell-brand">
          <span className="zmark">Z</span>
          <span>Decision workspace</span>
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
            <span>Decision case</span><b>#{marketKey}-091</b>
          </div>

          <div className="scope-row method-row"><span>Method</span><b>APA Intraday · v3</b></div>
          <div className="scope-row"><span>State</span><b>Signal preserved</b></div>
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
            <span>Method <b>matched</b></span>
            <span>Entry <b>{caseKey === "valid" ? "current" : "degraded"}</b></span>
          </div>

          <div className="delta">
            <div><span>Frozen entry</span><b>{frozenEntry}</b></div>
            <div><span>Current</span><b>{current}</b></div>
            <div><span>Gross R</span><b>{item.rr}</b></div>
          </div>

          <div className="mandate-line">
            <div><small>MANDATE BOUNDARY</small><b>{item.action}</b></div>
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
        <button className={caseKey === "valid" ? "on" : ""} onClick={() => setCaseKey("valid")}>Case still holds</button>
        <button className={caseKey === "degraded" ? "on" : ""} onClick={() => setCaseKey("degraded")}>Entry deteriorates</button>
        <span>Illustrative product logic · not live trading</span>
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
              {s.key === "method" && <em>Methodology and automation are separate choices.</em>}
              {s.key === "mandate" && <em>Buying automation access does not authorise a trade. Your mandate does.</em>}
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

  const [menu, setMenu] = useState(false);
  const [marketKey, setMarketKey] = useState("FX");
  const [caseKey, setCaseKey] = useState("valid");
  const [activeStep, setActiveStep] = useState("market");

  const nav = useMemo(() => [
    ["Product", "#product"],
    ["How it works", "#how"],
    ["Markets", "#markets"],
    ["Control", "#control"],
    ["Journal", "#journal"],
    ["Status", "#status"],
  ], []);

  const heroWords = ["The", "chart", "is", "not", "the", "market."];

  return (
    <>
      <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top"><span className="zmark">Z</span><b>ZUGRIO</b></a>
        <nav className={menu ? "nav-links open" : "nav-links"}>
          {nav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        </nav>
        <a className="header-cta" href="#early-access">Join early access</a>
        <button className="menu" aria-label="Toggle menu" onClick={() => setMenu(v => !v)}>{menu ? <X/> : <Menu/>}</button>
      </header>

      <main id="top">
        <section className="hero" id="product">
          <motion.div
            initial={prefersReduced ? false : "hidden"}
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: .09, delayChildren: .12 } }
            }}
            className="hero-copy"
          >
            <motion.div variants={{ hidden:{opacity:0,y:10},show:{opacity:1,y:0} }} className="eyebrow">
              <i/> MARKET-AWARE TRADING INTELLIGENCE · PRIVATE BUILD
            </motion.div>

            <h1 aria-label="The chart is not the market.">
              {heroWords.map((word, i) => (
                <motion.span
                  aria-hidden="true"
                  key={word + i}
                  variants={{
                    hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
                    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: .78, ease: [0.16,1,0.3,1] } }
                  }}
                >
                  {word}{i < heroWords.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </h1>

            <motion.p variants={{ hidden:{opacity:0,y:14},show:{opacity:1,y:0} }}>
              Zugrio evaluates each opportunity in the market that produced it, against your method and current conditions — then shows what still holds, what changed, and what is permitted next.
            </motion.p>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }}>
              <RollingDescriptors />
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }} className="hero-actions">
              <a className="primary" href="#early-access">Join the early-access waitlist <ArrowRight size={17}/></a>
              <a className="secondary" href="#how">Explore the decision preview <ChevronRight size={17}/></a>
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="hero-trust">
              Your capital stays in your broker account. You set the mandate; Zugrio evaluates what qualifies and acts only within the authority you grant.
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="scope">
              FX <span/> Gold <span/> Synthetic Indices
            </motion.div>
            <motion.small variants={{ hidden:{opacity:0},show:{opacity:1} }}>
              In development and private validation. No public trading access yet. No performance claim.
            </motion.small>
          </motion.div>

          <motion.div className="hero-product" style={{ scale: heroScale, rotateX: heroRotate, y: heroY, opacity: heroOpacity }}>
            <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
          </motion.div>
        </section>

        <SignalTicker />

        <motion.section className="bridge" {...sectionReveal}>
          <div className="kicker">ONE DECISION · MORE OF THE RELEVANT PICTURE</div>
          <h2>The chart is where a trade starts.<br/>Not where the decision ends.</h2>
          <p>Price tells you what happened. A trading decision also depends on what market produced that move, whether it fits your method, what is true now, what your account can absorb and what authority you have actually granted.</p>
        </motion.section>

        <motion.section className="annotation" {...sectionReveal}>
          <div>
            <div className="kicker">LIVE DECISION ANNOTATION</div>
            <h2>Watch the reasoning form on the chart.</h2>
            <p>Zugrio does not wait until the trade is over to explain itself. As structure develops, the chart can show what has actually been confirmed, what the system is waiting for and what would invalidate the case.</p>
          </div>
          <div className="annotation-sequence" aria-label="Illustrative live annotation sequence">
            <span><b>09:18</b><strong>Break confirmed</strong><small>Structure condition satisfied</small></span>
            <span><b>09:21</b><strong>Awaiting retest</strong><small>No entry permission yet</small></span>
            <span><b>09:24</b><strong>Retest qualified</strong><small>Current conditions rechecked</small></span>
            <em>Illustrative product states — not a live signal.</em>
          </div>
        </motion.section>

        <Story {...{ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }} />

        <motion.section className="discipline" {...sectionReveal}>
          <div className="kicker">CONSISTENCY UNDER PRESSURE</div>
          <h2>Your rules should not change because your mood did.</h2>
          <p>Long chart sessions create pressure: impatience, early entries, revenge re-entry, moving the goalposts after a loss, or seeing a setup because you want one to be there. Zugrio keeps applying the method you defined and records when you choose to override it.</p>
          <strong>The market does not care how long you have been watching it. Your evaluation standard should not either.</strong>
        </motion.section>

        <motion.section className="positive" id="control" {...sectionReveal}>
          <div className="positive-copy">
            <div className="kicker">WHEN THE CASE STILL HOLDS</div>
            <h2>Discipline should know when to proceed, too.</h2>
            <p>Zugrio is not being built simply to block trades. When the relevant evidence remains valid, the current entry still makes sense, account limits are respected and the required authority exists, the decision can progress appropriately.</p>
          </div>
          <div className="progression">
            {["Opportunity detected","Method requirements satisfied","Current context acceptable","Entry still qualifies","Risk available","Intent prepared","User approves","Broker acknowledges","Protection confirmed"].map((x,i) => (
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
            <div className="kicker">DECISION HISTORY</div>
            <h2>The reason stays with the trade.<br/>Hindsight doesn’t get to rewrite it.</h2>
            <p>Entered, passed, blocked, expired, missed and overridden opportunities all stay in the record. Outcome and process remain separate: a profitable trade is not automatically a good decision, and a losing trade is not automatically a bad one.</p>
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
            <div><span>PROCESS</span><b className="warn-text">METHOD VIOLATION</b></div>
          </motion.div>
        </motion.section>

        <motion.section className="markets" id="markets" {...sectionReveal}>
          <div className="kicker">INITIAL MARKET SCOPE</div>
          <h2>Built first for FX, Gold and Synthetic Indices.</h2>
          <p>These markets are being developed in parallel, with separate model scope, calibration, context and execution requirements.</p>
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
            <div className="kicker">PRODUCT STATUS</div>
            <h2>Know exactly what’s live.</h2>
            <p>Markets, brokers and control modes do not all become ready at once. Production status should show the exact scope that is released, in early access, under validation, research-only or locked.</p>
          </div>
          <div className="status-list">
            {[
              ["Released","Available inside its stated scope","STATUS LANGUAGE"],
              ["Early access","Limited invitation or cohort","STATUS LANGUAGE"],
              ["Validation pending","Not released for use","STATUS LANGUAGE"],
              ["Locked","Unavailable by policy or readiness","STATUS LANGUAGE"],
            ].map(([name,scope,state], i) => (
              <motion.div
                key={name}
                initial={{ opacity:0, x:22 }}
                whileInView={{ opacity:1, x:0 }}
                viewport={{ once:true }}
                transition={{ duration:.56, delay:i*.065, ease:[0.16,1,0.3,1] }}
              >
                <b>{name}</b><span>{scope}</span><em>{state}</em>
              </motion.div>
            ))}
            <small>This preview demonstrates readiness language only. It does not state that any market, broker or automation mode is currently released. A production board must be generated from authoritative capability data.</small>
          </div>
        </motion.section>

        <motion.section className="education" {...sectionReveal}>
          <div className="education-icon"><CircleAlert/></div>
          <div><div className="kicker">UNDERSTAND THE DECISION</div><h2>Know what the system is showing—and why it matters.</h2></div>
          <p>Zugrio will pair product intelligence with contextual learning: how market families differ, why an entry changed, what automation authority means and how to review a decision without hindsight.</p>
        </motion.section>

        <motion.section className="why" {...sectionReveal}>
          <div className="kicker">WHY ZUGRIO EXISTS</div>
          <h2>Good rules are easiest to follow away from the market.</h2>
          <p>They are harder to follow after a loss, deep into a session, or when a setup is almost — but not quite — there. Zugrio is being built to keep the method, the evidence, the mandate and the resulting decision connected from opportunity to outcome, so the same avoidable breakdown does not have to be rediscovered trade after trade.</p>
        </motion.section>

        <motion.section className="faq" {...sectionReveal}>
          <div className="kicker">QUESTIONS</div>
          <h2>What should you know before joining?</h2>
          {[
            ["What can I use today?","The current public experience is a product preview and waitlist. Zugrio is in development and private validation. Public trading access is not yet available."],
            ["Which markets are first?","FX, Gold and Synthetic Indices are the initial product tracks. Each requires its own data, calibration, cost and validation work."],
            ["Does Zugrio use one trading strategy?","No. Zugrio is designed around versioned Methods and entry models rather than one universal setup."],
            ["How does automation work?","Signal, Semi-Auto, Auto and Full Auto represent different levels of delegated authority. Execution remains bound to account, Method, market and risk rules."],
            ["Does Zugrio guarantee profitable trades?","No. A disciplined process can still produce a losing trade, just as a poor decision can sometimes make money. Zugrio is designed to improve decision consistency and traceability — not promise a return, win rate or profitable outcome."],
            ["What happens after I join?","You’ll receive product updates and early-access invitations as access opens. Joining does not create a trading account, connect a broker or authorise trading."],
          ].map(([q,a]) => <details key={q}><summary>{q}<ChevronRight size={16}/></summary><p>{a}</p></details>)}
        </motion.section>

        <SilverReveal />
        <Waitlist />
      </main>

      <footer>
        <a className="brand" href="#top"><span className="zmark">Z</span><b>ZUGRIO</b></a>
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
