import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown, Instagram } from "lucide-react";
import ZugrioSelect from "./ZugrioSelect.jsx";

const API_BASE = import.meta.env.VITE_WAITLIST_API_BASE || "";

const ROLE_OPTIONS = [
  { value: "independent_trader", label: "Independent trader" },
  { value: "prop_trader", label: "Prop trader" },
  { value: "trading_team", label: "Trading team / allocator" },
  { value: "researcher", label: "Researcher / builder" },
  { value: "broker_partner", label: "Broker / partner" },
  { value: "investor", label: "Investor" },
];

const MARKET_OPTIONS = [
  { value: "fx", label: "FX" },
  { value: "gold", label: "Gold / Commodities" },
  { value: "synthetics", label: "Synthetic Indices" },
  { value: "stocks", label: "Stocks / Equities" },
  { value: "crypto", label: "Crypto" },
  { value: "multiple", label: "Multiple" },
];

const HORIZON_OPTIONS = [
  { value: "scalping", label: "Scalping" },
  { value: "intraday", label: "Intraday" },
  { value: "swing", label: "Swing" },
  { value: "multiple", label: "Multiple" },
];

const MODE_OPTIONS = [
  { value: "signal", label: "Signal" },
  { value: "semi_auto", label: "Semi-Auto" },
  { value: "auto", label: "Auto" },
  { value: "full_auto_interest", label: "Full Auto interest" },
];

const STRATEGY_OPTIONS = [
  { value: "price_action_apa", label: "Price Action / APA" },
  { value: "smc", label: "SMC" },
  { value: "ict", label: "ICT" },
  { value: "qmr", label: "QMR" },
  { value: "other", label: "Other / custom" },
];

const PLATFORM_OPTIONS = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "both", label: "Desktop + mobile" },
];

const DISCOVERY_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X / Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "friend", label: "Friend / colleague" },
  { value: "community", label: "Trading community" },
  { value: "search", label: "Search" },
  { value: "other", label: "Other" },
];

const optionSets = {
  role: ROLE_OPTIONS,
  market: MARKET_OPTIONS,
  horizon: HORIZON_OPTIONS,
  mode: MODE_OPTIONS,
  strategy: STRATEGY_OPTIONS,
  platform: PLATFORM_OPTIONS,
  discovery: DISCOVERY_OPTIONS,
};

const initialFields = {
  email: "",
  role: "",
  market: "",
  horizon: "",
  mode: "",
  strategy: "",
  platform: "",
  country: "",
  discovery: "",
};

function optionLabel(field, value) {
  return optionSets[field]?.find(option => option.value === value)?.label || value;
}

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector('script[data-zugrio-turnstile="1"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.zugrioTurnstile = "1";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function Waitlist() {
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking signup availability…");
  const [fields, setFields] = useState(initialFields);
  const [consent, setConsent] = useState(false);
  const [config, setConfig] = useState(null);
  const [token, setToken] = useState("");
  const [successProfile, setSuccessProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const detailsRef = useRef(null);
  const challengeRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    (async () => {
      try {
        const response = await fetch(API_BASE + "/api/config", {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = await response.json();

        if (!response.ok || body.ready !== true || !body.siteKey) throw new Error("not-ready");
        if (cancelled) return;

        setConfig(body);
        await loadTurnstileScript();
        if (cancelled || !challengeRef.current || !window.turnstile) return;

        widgetRef.current = window.turnstile.render(challengeRef.current, {
          sitekey: body.siteKey,
          action: "waitlist",
          theme: "dark",
          size: "flexible",
          callback: value => {
            setToken(value);
            setStatus("ready");
            setMessage("Security check complete. Add your details and join when ready.");
          },
          "expired-callback": () => {
            setToken("");
            setStatus("attention");
            setMessage("The security check expired. Complete it again before joining.");
          },
          "error-callback": () => {
            setToken("");
            setStatus("attention");
            setMessage("The security check could not load. Refresh and try again.");
          },
        });

        setStatus("attention");
        setMessage("Complete the security check, then add your details.");
      } catch {
        if (cancelled) return;
        setStatus("preview");
        setMessage(
          location.hostname === "localhost" || location.hostname === "127.0.0.1"
            ? "Local UI preview. The real waitlist activates when this build runs with the Cloudflare API."
            : "Signup is temporarily unavailable. Nothing has been submitted."
        );
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
      if (widgetRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetRef.current); } catch {}
      }
    };
  }, []);

  function setField(name, value) {
    setFields(current => ({ ...current, [name]: value }));
  }

  function missingProfileFields() {
    return ["role","market","horizon","mode","strategy","platform","country","discovery"].filter(key => !fields[key].trim());
  }

  async function submit(event) {
    event.preventDefault();
    const missing = missingProfileFields();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      setStatus("attention");
      setMessage("Enter a valid email address before joining.");
      document.getElementById("email")?.focus();
      return;
    }

    if (missing.length) {
      if (detailsRef.current) detailsRef.current.open = true;
      setProfileOpen(true);
      setStatus("attention");
      setMessage("Complete the short trader profile before joining.");
      requestAnimationFrame(() => document.querySelector('[data-field="' + missing[0] + '"] button, [name="' + missing[0] + '"]')?.focus());
      return;
    }

    if (!consent) {
      setStatus("attention");
      setMessage("Confirm that we may send Zugrio product and early-access updates.");
      return;
    }

    if (!config || !token) {
      setStatus("attention");
      setMessage(config ? "Complete the security check before joining." : "The Cloudflare signup service is not connected in this local preview.");
      return;
    }

    const submitted = { ...fields };
    setStatus("submitting");
    setMessage("Registering your early-access profile…");

    const params = new URLSearchParams(location.search);
    const payload = {
      ...submitted,
      email: submitted.email.trim(),
      country: submitted.country.trim(),
      consent: true,
      token,
      company: String(new FormData(event.currentTarget).get("company") || ""),
      source: "landing-v3",
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(API_BASE + "/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.ok !== true || body.status !== "accepted") {
        throw new Error(
          response.status === 429 ? "Too many attempts. Wait a few minutes and try again." :
          response.status === 400 ? "Check your details and complete a fresh security check." :
          "We could not confirm your signup. Please try again."
        );
      }

      if (widgetRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetRef.current); } catch {}
        widgetRef.current = null;
      }

      setSuccessProfile(submitted);
      setStatus("success");
      setMessage("Early-access profile registered.");
      setFields(initialFields);
      setConsent(false);
      setToken("");
      if (detailsRef.current) detailsRef.current.open = false;
      setProfileOpen(false);
    } catch (error) {
      setStatus("error");
      setMessage(error.name === "AbortError" ? "Confirmation timed out. Please retry." : error.message);
      if (widgetRef.current !== null && window.turnstile) window.turnstile.reset(widgetRef.current);
      setToken("");
    } finally {
      clearTimeout(timeout);
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

        <a className="instagram-link" href="https://www.instagram.com/zugriohq/" target="_blank" rel="noreferrer">
          <Instagram size={15}/> Follow <b>@zugriohq</b>
        </a>
      </div>

      <div className="waitlist-stage">
        <AnimatePresence mode="wait">
          {status === "success" && successProfile ? (
            <motion.div
              key="success"
              className="waitlist-success"
              initial={reducedMotion ? false : { opacity: 0, y: 18, scale: .985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: .58, ease: [0.16,1,0.3,1] }}
              role="status"
              aria-live="polite"
            >
              {!reducedMotion && (
                <motion.div
                  className="success-scan"
                  aria-hidden="true"
                  initial={{ x: "-130%", opacity: 0 }}
                  animate={{ x: "155%", opacity: [0, .9, 0] }}
                  transition={{ duration: 1.25, ease: [0.16,1,0.3,1], delay: .08 }}
                />
              )}

              <div className="success-mark" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <motion.circle
                    cx="24" cy="24" r="21"
                    initial={reducedMotion ? false : { pathLength: 0, opacity: .25 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: .72, ease: "easeOut" }}
                  />
                  <motion.path
                    d="M15 24.5 21.2 31 34 17.8"
                    initial={reducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: .5, delay: reducedMotion ? 0 : .42, ease: "easeOut" }}
                  />
                </svg>
              </div>

              <div className="success-kicker">EARLY ACCESS · REGISTERED</div>
              <h3>You’re on the inside.</h3>
              <p>Your early-access profile is now part of the build. We’ll use what you shared to make future product previews, testing groups and invitations more relevant as access opens.</p>

              <div className="success-profile" aria-label="Your early-access profile">
                <span>{optionLabel("market", successProfile.market)}</span>
                <i />
                <span>{optionLabel("horizon", successProfile.horizon)}</span>
                <i />
                <span>{optionLabel("mode", successProfile.mode)}</span>
              </div>

              <div className="success-meta">
                <span>Profile captured</span>
                <span>Updates enabled</span>
              </div>

              <div className="success-actions">
                <a href="https://www.instagram.com/zugriohq/" target="_blank" rel="noreferrer">
                  <Instagram size={14}/> Follow @zugriohq
                </a>
                <a href="#product">Back to the product <ArrowRight size={14}/></a>
              </div>

              <small>Joining the waitlist does not guarantee access or authorise trading.</small>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              noValidate
              initial={false}
              exit={reducedMotion ? undefined : { opacity: 0, y: -12, filter: "blur(5px)" }}
              transition={{ duration: .28 }}
            >
              <label htmlFor="email">Email</label>
              <div className="form-row">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength="254"
                  required
                  value={fields.email}
                  onChange={event => setField("email", event.target.value)}
                  placeholder="you@example.com"
                />
                <button type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Registering…" : "Join the waitlist"}
                  <ArrowRight size={16}/>
                </button>
              </div>

              <details
                className="required-profile"
                ref={detailsRef}
                onToggle={event => setProfileOpen(event.currentTarget.open)}
              >
                <summary>
                  <span><b>Tell us how you trade</b><small>Required · about 30 seconds</small></span>
                  <ChevronDown size={16}/>
                </summary>

                <div className="profile-grid">
                  <ZugrioSelect label="Your role" name="role" required value={fields.role} onChange={setField} options={ROLE_OPTIONS} />
                  <ZugrioSelect label="Primary market" name="market" required value={fields.market} onChange={setField} options={MARKET_OPTIONS} />
                  <ZugrioSelect label="Trading horizon" name="horizon" required value={fields.horizon} onChange={setField} options={HORIZON_OPTIONS} />
                  <ZugrioSelect label="Preferred control" name="mode" required value={fields.mode} onChange={setField} options={MODE_OPTIONS} />
                  <ZugrioSelect label="Method / strategy interest" name="strategy" required value={fields.strategy} onChange={setField} options={STRATEGY_OPTIONS} />
                  <ZugrioSelect label="Primary platform" name="platform" required value={fields.platform} onChange={setField} options={PLATFORM_OPTIONS} />

                  <label className="profile-text-field">
                    <span>Country / region <i aria-hidden="true">·</i></span>
                    <input
                      name="country"
                      type="text"
                      autoComplete="country-name"
                      maxLength="80"
                      required
                      value={fields.country}
                      onChange={event => setField("country", event.target.value)}
                      placeholder="e.g. Nigeria"
                    />
                  </label>

                  <ZugrioSelect label="How did you hear about Zugrio?" name="discovery" required value={fields.discovery} onChange={setField} options={DISCOVERY_OPTIONS} />
                </div>
              </details>

              <div className="honeypot" aria-hidden="true">
                <label>Company<input name="company" tabIndex="-1" autoComplete="off" /></label>
              </div>

              <div className="turnstile-host" ref={challengeRef} />

              <label className="consent">
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/>
                <span>Send me Zugrio product updates and early-access invitations. I can withdraw at any time.</span>
              </label>

              {profileOpen && (
                <button className="profile-submit-bottom" type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Registering…" : "Join the early-access waitlist"}
                  <ArrowRight size={16}/>
                </button>
              )}

              <p className={"form-status " + status} role="status" aria-live="polite">{message}</p>
              <p className="form-fine">No payment, password or broker credentials required. Joining does not create a trading account or authorise trading.</p>

              <details className="privacy-mini">
                <summary>Privacy & data use</summary>
                <p>We use your email and trader profile to manage early access, understand product demand and send the updates you consent to receive. Waitlist records are scheduled for deletion after 12 months unless you withdraw earlier.</p>
                {config?.privacyContact && <p>Questions, access, correction or deletion: <a href={"mailto:" + config.privacyContact}>{config.privacyContact}</a></p>}
              </details>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
