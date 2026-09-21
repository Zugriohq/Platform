import React, { useMemo, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, Check, ChevronRight, CircleAlert, Clock3, LockKeyhole,
  Menu, ShieldCheck, X, Zap, History, Activity, Layers3
} from "lucide-react";

const MARKETS = {
  FX: { label: "EUR/USD", family: "FX", price: "1.08462", note: "London / New York overlap", status: "Model coverage available" },
  GOLD: { label: "Gold / USD", family: "Gold", price: "2,614.30", note: "US session", status: "Separate market scope" },
  SYNTH: { label: "Jump 50", family: "Synthetic", price: "183.42", note: "Synthetic specialist", status: "Family-specific evaluation" },
};

const CASES = {
  valid: {
    label: "Current entry qualifies",
    tone: "good",
    current: "1.08434",
    rr: "1.88R",
    copy: "The method still qualifies, current conditions remain acceptable and the prepared intent is waiting for approval.",
    action: "Prepared · Semi-Auto",
  },
  degraded: {
    label: "Entry no longer qualifies",
    tone: "warn",
    current: "1.08580",
    rr: "0.67R",
    copy: "The original signal remains recorded, but current entry economics have deteriorated. The system does not silently relabel the old entry as current.",
    action: "Pass · Reassess",
  },
};

const STORY = [
  {
    key: "market",
    overline: "MARKET",
    title: "Same pattern. Different market. Different answer.",
    body: "A similar-looking move can come from a different market family, product and execution environment. Zugrio starts by asking what it is actually looking at.",
  },
  {
    key: "method",
    overline: "METHOD",
    title: "Your method sets the rules. Zugrio doesn’t silently bend them.",
    body: "Your method defines what qualifies, what evidence is required, which entry models are allowed and what invalidates the idea.",
  },
  {
    key: "moment",
    overline: "CURRENT CONDITIONS",
    title: "If the facts change, the trade changes.",
    body: "Price, spread, entry economics, regime, macro events, session and account state can all change after the original setup appears.",
  },
  {
    key: "mandate",
    overline: "CONTROL",
    title: "A signal is not permission.",
    body: "Market intelligence, account risk, execution authority and broker reality remain separate. Automation can only act inside the mandate you explicitly set.",
  },
  {
    key: "memory",
    overline: "DECISION HISTORY",
    title: "The reason stays with the trade.",
    body: "The original case, changes, override, broker result and outcome remain attached so hindsight cannot quietly rewrite the process.",
  },
];

function Shell({ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }) {
  const market = MARKETS[marketKey];
  const item = CASES[caseKey];
  return (
    <div className="product-shell" aria-label="Illustrative Zugrio decision workspace">
      <div className="shell-top">
        <div className="shell-brand">
          <span className="zmark">Z</span>
          <span>Decision workspace</span>
        </div>
        <div className="shell-health"><i /> 37s fresh</div>
        <div className="shell-account">DEMO · SIGNAL / SEMI</div>
      </div>

      <div className="market-switcher" role="group" aria-label="Illustrative market">
        {Object.entries(MARKETS).map(([key, m]) => (
          <button key={key} className={marketKey === key ? "on" : ""} onClick={() => setMarketKey(key)}>
            <span>{m.family}</span><b>{m.label}</b>
          </button>
        ))}
      </div>

      <div className="case-grid">
        <div className="chart-panel">
          <div className="chart-head">
            <div><small>{market.family}</small><h3>{market.label}</h3></div>
            <div className="live-price"><small>Illustrative price</small><strong>{market.price}</strong></div>
          </div>
          <svg className="chart" viewBox="0 0 760 300" role="img" aria-label="Illustrative price chart">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".15"/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {[60,120,180,240].map(y => <line key={y} x1="0" x2="760" y1={y} y2={y} className="grid-line" />)}
            <path className="area" d="M0 242 L40 226 L80 232 L120 190 L160 205 L200 166 L240 174 L280 130 L320 145 L360 108 L400 120 L440 84 L480 116 L520 92 L560 112 L600 75 L640 104 L680 70 L720 88 L760 62 L760 300 L0 300Z" />
            <path className="price-line" d="M0 242 L40 226 L80 232 L120 190 L160 205 L200 166 L240 174 L280 130 L320 145 L360 108 L400 120 L440 84 L480 116 L520 92 L560 112 L600 75 L640 104 L680 70 L720 88 L760 62" />
            <line x1="0" x2="760" y1="158" y2="158" className="frozen-line" />
            <text x="12" y="151" className="svg-label">frozen entry</text>
            <line x1="0" x2="760" y1={caseKey === "valid" ? "148" : "103"} y2={caseKey === "valid" ? "148" : "103"} className="current-line" />
            <text x="630" y={caseKey === "valid" ? "140" : "95"} className="svg-label strong">current</text>
          </svg>
          <div className="chart-foot">
            <span>{market.note}</span>
            <span>{market.status}</span>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-title">
            <span>Decision case</span><b>#EUR-091</b>
          </div>
          <div className="scope-row"><span>Method</span><b>APA Intraday · v3</b></div>
          <div className="scope-row"><span>State</span><b>Signal preserved</b></div>

          <div className={"now-card " + item.tone}>
            <div className="now-label">WHAT CHANGED</div>
            <strong>{item.label}</strong>
            <p>{item.copy}</p>
          </div>

          <div className="delta">
            <div><span>Frozen entry</span><b>1.08420</b></div>
            <div><span>Current</span><b>{item.current}</b></div>
            <div><span>Gross R</span><b>{item.rr}</b></div>
          </div>

          <div className="mandate-line">
            <div><small>AUTHORITY</small><b>{item.action}</b></div>
            <LockKeyhole size={16}/>
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
          {STORY.map((s) => (
            <motion.article
              key={s.key}
              className={"story-step " + (activeStep === s.key ? "active" : "")}
              onViewportEnter={() => setActiveStep(s.key)}
              viewport={{ amount: .6, margin: "-10% 0px -20% 0px" }}
            >
              <div className="kicker">{s.overline}</div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.key === "market" && <em>Different markets deserve different intelligence.</em>}
              {s.key === "mandate" && <em>Automation access does not authorise a trade. Your mandate does.</em>}
              {s.key === "memory" && <em>Hindsight doesn’t get to rewrite it.</em>}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Waitlist() {
  const [status, setStatus] = useState("ready");
  const [email, setEmail] = useState("");
  async function submit(e) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing-v3-prototype" }),
      });
      if (!res.ok) throw new Error("unavailable");
      setStatus("success");
    } catch {
      setStatus("unavailable");
    }
  }
  return (
    <section className="waitlist" id="early-access">
      <div className="waitlist-copy">
        <div className="kicker">EARLY ACCESS</div>
        <h2>See the market. Keep your method. Stay in control.</h2>
        <p>Join the waitlist for product previews, build updates and invitations as Zugrio opens access.</p>
        <div className="journey">
          <span><b>01</b> Join the list</span>
          <span><b>02</b> Get invited</span>
          <span><b>03</b> Create your account</span>
        </div>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <div className="form-row">
          <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <button type="submit" disabled={status === "submitting"}>Join the waitlist <ArrowRight size={16}/></button>
        </div>
        <label className="consent"><input type="checkbox" required/> Send me Zugrio product updates and early-access invitations.</label>
        <p className={"form-status " + status}>
          {status === "ready" && "No payment, password or broker credentials required. Joining does not create an account."}
          {status === "submitting" && "Submitting…"}
          {status === "success" && "You’re on the list. Check your email for future updates."}
          {status === "unavailable" && "Signup is not connected in this prototype. Your email has not been stored."}
        </p>
      </form>
    </section>
  );
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, .12], [0.86, 1]);
  const heroRotate = useTransform(scrollYProgress, [0, .12], [prefersReduced ? 0 : 2.2, 0]);
  const heroY = useTransform(scrollYProgress, [0, .12], [prefersReduced ? 0 : 70, 0]);

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

  return (
    <>
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
          <motion.div initial={prefersReduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} className="hero-copy">
            <div className="eyebrow"><i/> MARKET-AWARE TRADING INTELLIGENCE · PRIVATE BUILD</div>
            <h1>The chart is not the market.</h1>
            <p>Zugrio evaluates each opportunity in the market that produced it, against your method and current conditions—then shows what still holds, what changed, and what, if anything, is permitted next.</p>
            <div className="hero-actions">
              <a className="primary" href="#early-access">Join the early-access waitlist <ArrowRight size={17}/></a>
              <a className="secondary" href="#how">Explore the decision preview <ChevronRight size={17}/></a>
            </div>
            <div className="scope">FX <span/> Gold <span/> Synthetic Indices</div>
            <small>In development and private validation. No public trading access yet. No performance claim.</small>
          </motion.div>

          <motion.div className="hero-product" style={{ scale: heroScale, rotateX: heroRotate, y: heroY }}>
            <Shell {...{ activeStep, marketKey, setMarketKey, caseKey, setCaseKey }} />
          </motion.div>
        </section>

        <section className="bridge">
          <div className="kicker">ONE DECISION · MORE OF THE RELEVANT PICTURE</div>
          <h2>The chart is where a trade starts.<br/>Not where the decision ends.</h2>
          <p>Price tells you what happened. A trading decision also depends on what market produced that move, whether it fits your method, what is true now, what your account can absorb and what authority you have actually granted.</p>
        </section>

        <Story {...{ activeStep, setActiveStep, marketKey, setMarketKey, caseKey, setCaseKey }} />

        <section className="positive" id="control">
          <div className="positive-copy">
            <div className="kicker">WHEN THE CASE STILL HOLDS</div>
            <h2>Discipline should know when to proceed, too.</h2>
            <p>Zugrio is not being built simply to block trades. When the relevant evidence remains valid, the current entry still makes sense, account limits are respected and the required authority exists, the decision can progress appropriately.</p>
          </div>
          <div className="progression">
            {["Opportunity detected","Method requirements satisfied","Current context acceptable","Entry still qualifies","Risk available","Intent prepared","User approves","Broker acknowledges","Protection confirmed"].map((x,i) => (
              <div key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b><Check size={15}/></div>
            ))}
            <small>Illustrative workflow only. Not a live trade, signal or performance result.</small>
          </div>
        </section>

        <section className="journal" id="journal">
          <div>
            <div className="kicker">DECISION HISTORY</div>
            <h2>The reason stays with the trade.<br/>Hindsight doesn’t get to rewrite it.</h2>
            <p>Entered, passed, missed, blocked, expired and overridden opportunities all belong in the record—not only winning trades.</p>
          </div>
          <div className="record-card">
            <div><span>SYSTEM</span><b>PASS</b></div>
            <div><span>USER</span><b>OVERRIDE</b></div>
            <div><span>OUTCOME</span><b>PROFIT</b></div>
            <div><span>PROCESS</span><b className="warn-text">METHOD VIOLATION</b></div>
          </div>
        </section>

        <section className="markets" id="markets">
          <div className="kicker">INITIAL MARKET SCOPE</div>
          <h2>Built first for FX, Gold and Synthetic Indices.</h2>
          <p>These markets are being developed in parallel, with separate model scope, calibration, context and execution requirements.</p>
          <div className="market-cards">
            <article><Activity/><b>FX</b><span>Market/session/macro-aware</span></article>
            <article><Layers3/><b>Gold</b><span>Separately scoped behavior and costs</span></article>
            <article><Zap/><b>Synthetic Indices</b><span>Specialist family logic where validated</span></article>
          </div>
        </section>

        <section className="status-board" id="status">
          <div className="status-copy">
            <div className="kicker">PRODUCT STATUS</div>
            <h2>Know exactly what’s live.</h2>
            <p>Markets, brokers and control modes do not all become ready at once. Production status should show the exact scope that is released, in early access, under validation, research-only or locked.</p>
          </div>
          <div className="status-list">
            {[
              ["FX · Signal","Illustrative","released"],
              ["Gold · Semi-Auto","Illustrative","early access"],
              ["MT5 Auto","Illustrative","validation pending"],
              ["Full Auto","Illustrative","locked"],
            ].map(([name,scope,state]) => <div key={name}><b>{name}</b><span>{scope}</span><em>{state}</em></div>)}
            <small>Example states only. The live site must be sourced from authoritative capability data.</small>
          </div>
        </section>

        <section className="education">
          <div className="education-icon"><CircleAlert/></div>
          <div><div className="kicker">UNDERSTAND THE DECISION</div><h2>Know what the system is showing—and why it matters.</h2></div>
          <p>Zugrio will pair product intelligence with contextual learning: how market families differ, why an entry changed, what automation authority means and how to review a decision without hindsight.</p>
        </section>

        <section className="faq">
          <div className="kicker">QUESTIONS</div>
          <h2>What should you know before joining?</h2>
          {[
            ["What can I use today?","The current public experience is a product preview and waitlist. Zugrio is in development and private validation. Public trading access is not yet available."],
            ["Which markets are first?","FX, Gold and Synthetic Indices are the initial product tracks. Each requires its own data, calibration, cost and validation work."],
            ["Does Zugrio use one trading strategy?","No. Zugrio is designed around versioned Methods and entry models rather than one universal setup."],
            ["How does automation work?","Signal, Semi-Auto, Auto and Full Auto represent different levels of delegated authority. Execution remains bound to account, Method, market and risk rules."],
            ["Does Zugrio guarantee profitable trades?","No. Trading involves risk of loss. Zugrio does not guarantee a return, win rate or profitable outcome."],
            ["What happens after I join?","You’ll receive product updates and early-access invitations as access opens. Joining does not create a trading account, connect a broker or authorise trading."],
          ].map(([q,a]) => <details key={q}><summary>{q}<ChevronRight size={16}/></summary><p>{a}</p></details>)}
        </section>

        <Waitlist />
      </main>

      <footer>
        <a className="brand" href="#top"><span className="zmark">Z</span><b>ZUGRIO</b></a>
        <p>Zugrio is in development and private validation. Product screens, prices and trading scenarios shown on this site may be illustrative. They are not investment recommendations, live signals or performance claims. Trading involves risk of loss.</p>
        <div><a href="#status">Product status</a><a href="#early-access">Early access</a><a href="#top">Back to top</a></div>
      </footer>
    </>
  );
}
