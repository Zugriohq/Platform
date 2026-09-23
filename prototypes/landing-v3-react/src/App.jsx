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
import BrandWordmark from "./BrandWordmark.jsx";
import BrandIntro from "./BrandIntro.jsx";
import MarketTopography from "./MarketTopography.jsx";

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
    copy: "The strategy still qualifies, current conditions remain acceptable and the next action is available inside your selected control level.",
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
    title: "Same setup. Different market. Different answer.",
    body: "A move can look similar on EUR/USD, Gold and a Synthetic Index and still behave differently. Zugrio evaluates each setup inside the market that produced it instead of assuming the same chart pattern means the same thing everywhere.",
  },
  {
    key: "method",
    overline: "STRATEGY",
    title: "Your strategy sets the rules. Zugrio keeps checking them.",
    body: "Zugrio Core is the default starting strategy and remains under validation. Choose another supported strategy where available. Zugrio shows where a strategy fits your market and trading horizon, keeps its evidence limits visible, and never pretends one strategy is best everywhere. Once selected, the rules stay consistent through losses and long sessions.",
  },
  {
    key: "moment",
    overline: "CURRENT CONDITIONS",
    title: "A good setup can become a bad entry.",
    body: "Price can move after a signal fires. The spread can widen. News, session conditions and account risk can change. Zugrio keeps the original signal, then checks what still makes sense now. Relevant context stays tied to the instrument with its source and freshness visible, and missing or stale evidence stays visible too.",
  },
  {
    key: "mandate",
    overline: "CONTROL",
    title: "A signal is not the same as “trade now.”",
    body: "When a setup is triggered, Zugrio checks the current price, costs, account risk and the control level you chose. Signal, Semi-Auto, Auto and Full Auto are different levels of control — not shortcuts around your rules. Zugrio also keeps prepared, submitted, acknowledged, filled and protected states distinct so broker reality is never collapsed into one green check.",
  },
  {
    key: "memory",
    overline: "DECISION HISTORY",
    title: "See what happened — not just whether you won.",
    body: "The setup, the signal, what changed, what you did and the result stay connected. Replay lets you return to what was known at the time, while passed and missed cases remain part of the record. That makes it easier to separate decision quality, execution quality and financial outcome.",
  },
];

const TICKER = [
  "Strategy-aware scanning",
  "FORMING → READY → TRIGGERED",
  "Background alerts",
  "Live chart reasoning",
  "Behavioral analytics",
  "Your control stays explicit",
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
              {s.key === "mandate" && <em>More automation never means more permission than you chose to give.</em>}
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

  const nav = useMemo(() => [
    ["Product", "#product"],
    ["How it works", "#how"],
    ["Markets", "#markets"],
    ["Control", "#control"],
    ["Review", "#journal"],
    ["Readiness", "#status"],
  ], []);

  const heroWords = ["Find", "your", "setup.", "Know", "what’s", "next."];

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
              <i/> MARKET-AWARE TRADING INTELLIGENCE · PRIVATE BUILD
            </motion.div>

            <h1 aria-label="Find your setup. Know what’s next.">
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
              Zugrio scans supported markets with Zugrio Core or the strategy you choose, follows setups from FORMING to READY to TRIGGERED, and alerts you when something changes — with the levels, reasoning and next step kept together.
            </motion.p>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }}>
              <RollingDescriptors />
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0,y:12},show:{opacity:1,y:0} }} className="hero-actions">
              <a className="primary" href="#early-access">Join the early-access waitlist <ArrowRight size={17}/></a>
              <a className="secondary" href="#how">Explore the decision preview <ChevronRight size={17}/></a>
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="hero-trust">
              Your money stays in your broker account. In Signal mode, you keep execution control. More automation only works inside the trading limits and permissions you choose.
            </motion.div>

            <motion.div variants={{ hidden:{opacity:0},show:{opacity:1} }} className="scope">
              FX <span/> Gold <span/> Synthetic Indices
            </motion.div>
            <motion.small variants={{ hidden:{opacity:0},show:{opacity:1} }}>
              Private build. Zugrio Core and other product capabilities are under validation. No public trading access yet. No performance claim.
            </motion.small>
          </motion.div>

          <motion.div className="hero-product" style={{ scale: heroScale, rotateX: heroRotate, y: heroY, opacity: heroOpacity }}>
            <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
          </motion.div>
        </section>

        <SignalTicker />

        <motion.section className="bridge" {...sectionReveal}>
          <div className="kicker">SCAN IN THE BACKGROUND · STEP IN WHEN IT MATTERS</div>
          <h2>You don’t need to stare at every chart all day.</h2>
          <p>Zugrio starts with the markets you follow: the relevant session, scheduled events, current conditions and setups that deserve attention. Then it keeps scanning in the background. When a setup forms, becomes ready, triggers or stops qualifying, Zugrio alerts you and brings the case back with the important levels, reasoning and next step. You control the notifications you receive, and delivery status stays visible.</p>
        </motion.section>

        <motion.section className="annotation" {...sectionReveal}>
          <div>
            <div className="kicker">OPPORTUNITY PROGRESSION</div>
            <h2>Watch a setup move from FORMING to READY to TRIGGERED.</h2>
            <p>FORMING means a possible setup is developing and some required conditions are still missing. READY means the strategy’s required conditions are in place and Zugrio is waiting for the defined trigger. TRIGGERED means that trigger has occurred and the signal is created. Zugrio marks that reasoning on the chart as it forms, so you can see what is confirmed, what it is waiting for and what would invalidate the setup. If the setup weakens, invalidates or expires, Zugrio says that too. A triggered alert carries the instrument, direction, strategy, time, entry reference, invalidation, targets and supporting evidence together.</p>
          </div>
          <div className="annotation-sequence" aria-label="Illustrative live annotation sequence">
            <span><b>09:18</b><strong>FORMING</strong><small>Setup developing · conditions still missing</small></span>
            <span><b>09:21</b><strong>READY</strong><small>Strategy conditions in place · waiting for trigger</small></span>
            <span><b>09:24</b><strong>TRIGGERED</strong><small>Defined trigger satisfied · signal fired</small></span>
            <em>Illustrative progression — not a live signal.</em>
          </div>
        </motion.section>

        <Story {...{ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }} />

        <motion.section className="discipline" {...sectionReveal}>
          <div className="kicker">CONSISTENCY UNDER PRESSURE</div>
          <h2>Your rules don’t change because your mood did.</h2>
          <p>Long chart sessions create pressure: impatience, early entries, revenge re-entry, chasing price after an alert, changing risk after a loss, or seeing a setup because you want one to be there. Zugrio keeps applying the strategy you chose and records when your actions move away from the plan.</p>
          <strong>The market does not care how long you have been watching it. Your evaluation standard doesn’t change either.</strong>
        </motion.section>

        <motion.section className="positive" id="control" {...sectionReveal}>
          <div className="positive-copy">
            <div className="kicker">AFTER A SIGNAL FIRES</div>
            <h2>TRIGGERED means the setup fired. Zugrio checks what is true now.</h2>
            <p>An alert captures a moment in time. Zugrio rechecks the current price, spread, account risk and the control level you chose before the next action — so a signal that was valid a few minutes ago is never treated as a fresh entry forever.</p>
          </div>
          <div className="progression">
            {["Signal fired","Current price checked","Spread / costs checked","Entry still acceptable","Account risk available","Control level checked","Next action prepared","Broker acknowledges","Protection confirmed"].map((x,i) => (
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
            <div className="kicker">BEHAVIORAL ANALYTICS & DECISION REVIEW</div>
            <h2>Connect the plan to what you actually did.</h2>
            <p>With a supported read-only broker connection, Signal mode compares the setup Zugrio showed you with the trade you actually took — without permission to place orders. Zugrio identifies factual patterns such as early entries, chased price, changed risk, early exits and overrides; it does not pretend a trade record can prove what you felt. In Semi-Auto and Auto, system decisions and your own interventions stay separately attributed. Review then answers three different questions: was the decision consistent with the strategy, was it executed according to plan, and what was the financial outcome?</p>
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
            <div className="kicker">WHAT IS LIVE · WHAT IS STILL BEING BUILT</div>
            <h2>Know what you can actually use.</h2>
            <p>Markets, broker connections and control modes have separate readiness. Zugrio shows clearly what is released, what is in early access, what is still under validation and what is unavailable.</p>
          </div>
          <div className="status-list">
            {[
              ["Released","Available inside its stated scope","ILLUSTRATIVE STATE"],
              ["Early access","Limited invitation or cohort","ILLUSTRATIVE STATE"],
              ["Validation pending","Not released for use","ILLUSTRATIVE STATE"],
              ["Locked","Unavailable by policy or readiness","ILLUSTRATIVE STATE"],
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
            <small>This preview demonstrates the readiness language only. It does not state that any market, broker or automation mode is currently released. Live status always reflects authoritative capability data.</small>
          </div>
        </motion.section>

        <motion.section className="education" {...sectionReveal}>
          <div className="education-icon"><CircleAlert/></div>
          <div><div className="kicker">UNDERSTAND WHAT YOU SEE</div><h2>Know why the setup is changing.</h2></div>
          <p>Zugrio explains the strategy, the market, what changed after the signal and what your selected control mode allows — without forcing traders to learn internal system vocabulary first. If you trade a discretionary plan that Zugrio does not automate, you can still record the conditions, invalidation and risk before acting, then review adherence without Zugrio pretending it validated the trading thesis for you.</p>
        </motion.section>

        <motion.section className="why" {...sectionReveal}>
          <div className="kicker">WHY ZUGRIO EXISTS</div>
          <h2>Good rules get harder to follow in a live market.</h2>
          <p>After a loss, deep into a session, or when a setup is almost right, traders can enter early, chase price, change risk or abandon their own plan. Zugrio stays useful before, during and after the trade: it keeps the strategy, the changing setup, your actions and the result connected so you can see what really happened and improve from it.</p>
        </motion.section>

        <motion.section className="faq" {...sectionReveal}>
          <div className="kicker">QUESTIONS</div>
          <h2>What to know before joining.</h2>
          {[
            ["What can I use today?","The current public experience is a product preview and waitlist. Zugrio is in development and private validation. Public trading access is not yet available."],
            ["Which markets are first?","FX, Gold and Synthetic Indices are the initial product tracks. Each requires its own data, calibration, cost and validation work."],
            ["Does Zugrio use one trading strategy?","Zugrio Core is the default starting strategy and remains under validation. Zugrio also supports clearly defined strategies where their rules, market scope and evidence are implemented."],
            ["How does automation work?","Signal, Semi-Auto, Auto and Full Auto represent different levels of control. Signal keeps execution with you. More automated modes act only inside the account rules, strategy rules and permissions you choose, and only where that capability is available."],
            ["What does behavioral analytics actually show?","With a supported read-only broker connection, Zugrio compares the plan with what actually happened: timing, entry, size or risk changes, early exits, overrides and other observable actions. It separates system actions from your interventions and keeps decision quality, execution quality and financial outcome as different questions. It does not claim to infer emotions from a trade record."],
            ["Can I use my own discretionary plan?","Yes. You can record a manual plan — including the conditions, invalidation and risk — even when Zugrio does not automate that strategy. Zugrio can then help you review adherence and execution without claiming that it independently validated the trading thesis."],
            ["What happens when there is no setup?","No setup is a valid answer. Zugrio shows when nothing qualifies, when evidence is missing or stale, and when a setup expires or invalidates instead of manufacturing activity to keep the screen busy."],
            ["Can I review a past decision?","Decision replay preserves what was known at the time so you can revisit the setup without using later information to rewrite the earlier choice. Passed and missed cases remain reviewable too. Over a meaningful sample, strategy health stays separated by market and strategy version and shows where evidence is strong, weak or still insufficient."],
            ["How does desktop and mobile fit together?","Desktop gives you the fuller trading workspace. Mobile keeps alerts, the current trade case and the next relevant step accessible. Moving between devices preserves the same case and its history rather than starting a disconnected view."],
            ["Does Zugrio guarantee profitable trades?","No. A disciplined process can still produce a losing trade, just as a poor decision can sometimes make money. Zugrio improves decision consistency and traceability; it does not promise a return, win rate or profitable outcome."],
            ["What happens after I join?","You’ll receive product updates and early-access invitations as access opens. Joining does not create a trading account, connect a broker or authorise trading."],
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
