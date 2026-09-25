import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Instagram } from "lucide-react";

const API_BASE = import.meta.env.VITE_WAITLIST_API_BASE || "";

const SEGMENT_OPTIONS = [
  { value: "fx", label: "FX" },
  { value: "gold", label: "Gold" },
  { value: "synthetics", label: "Synthetic Indices" },
  { value: "multiple", label: "More than one" },
];

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
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [config, setConfig] = useState(null);
  const [token, setToken] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [profileToken, setProfileToken] = useState("");
  const [segment, setSegment] = useState("");
  const [segmentState, setSegmentState] = useState("idle");
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
            setMessage("Security check complete. Join when ready.");
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
        setMessage("Complete the security check, then join early access.");
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

  async function submit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus("attention");
      setMessage("Enter a valid email address before joining.");
      document.getElementById("email")?.focus();
      return;
    }

    if (!consent) {
      setStatus("attention");
      setMessage("Confirm that we may send Zugrio product and early-access updates.");
      return;
    }

    if (!config || !token) {
      setStatus("attention");
      setMessage(config ? "Complete the security check before joining." : "The signup service is not connected in this preview.");
      return;
    }

    setStatus("submitting");
    setMessage("Registering early access…");

    const params = new URLSearchParams(location.search);
    const payload = {
      email: normalizedEmail,
      consent: true,
      token,
      company: String(new FormData(event.currentTarget).get("company") || ""),
      source: "landing-v5",
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
          response.status === 400 ? "Check your email and complete a fresh security check." :
          "We could not confirm your signup. Please try again."
        );
      }

      if (widgetRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetRef.current); } catch {}
        widgetRef.current = null;
      }

      setSuccessEmail(normalizedEmail);
      setProfileToken(String(body.profileToken || ""));
      setStatus("success");
      setMessage("You’re on the list.");
      setEmail("");
      setConsent(false);
      setToken("");
    } catch (error) {
      setStatus("error");
      setMessage(error.name === "AbortError" ? "Confirmation timed out. Please retry." : error.message);
      if (widgetRef.current !== null && window.turnstile) window.turnstile.reset(widgetRef.current);
      setToken("");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function saveSegment(value) {
    setSegment(value);
    if (!profileToken) {
      setSegmentState("unavailable");
      return;
    }

    setSegmentState("saving");
    try {
      const response = await fetch(API_BASE + "/api/waitlist-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ profileToken, market: value }),
      });
      const body = await response.json().catch(() => null);
      setSegmentState(response.ok && body?.ok === true ? "saved" : "unavailable");
    } catch {
      setSegmentState("unavailable");
    }
  }

  return (
    <section className="waitlist" id="early-access">
      <div className="waitlist-copy">
        <div className="kicker">EARLY ACCESS</div>
        <h2>Get closer to Zugrio.</h2>
        <p>Join the early-access list for meaningful product milestones, validation updates and invitations as eligible capabilities and scopes open.</p>

        <div className="access-principles" aria-label="Early access principles">
          <div><span>01</span><b>NO PAYMENT</b></div>
          <div><span>02</span><b>NO PASSWORD</b></div>
          <div><span>03</span><b>NO BROKER DETAILS</b></div>
        </div>

        <a className="instagram-link" href="https://www.instagram.com/zugriohq/" target="_blank" rel="noreferrer">
          <Instagram size={15}/> Follow <b>@zugriohq</b>
        </a>
      </div>

      <div className="waitlist-stage">
        <AnimatePresence mode="wait">
          {status === "success" && successEmail ? (
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

              <div className="success-kicker">EARLY ACCESS / REGISTERED</div>
              <h3>You’re on the list.</h3>
              <p>We’ll write when there is something meaningful to show you.</p>

              <div className="segment-prompt">
                <span>OPTIONAL</span>
                <strong>What do you trade most?</strong>
                <div className="segment-options">
                  {SEGMENT_OPTIONS.map(option => (
                    <button
                      type="button"
                      className={segment === option.value ? "selected" : ""}
                      onClick={() => saveSegment(option.value)}
                      key={option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {segmentState === "saved" && <small>Preference saved.</small>}
                {segmentState === "unavailable" && <small>Your signup is complete. Preference saving is temporarily unavailable.</small>}
                {segmentState === "saving" && <small>Saving preference…</small>}
              </div>

              <div className="success-actions">
                <a href="https://www.instagram.com/zugriohq/" target="_blank" rel="noreferrer">
                  <Instagram size={14}/> Follow @zugriohq
                </a>
                <a href="#product">Back to the product <ArrowRight size={14}/></a>
              </div>

              <small>Joining does not connect a broker or grant trading authority.</small>
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
              <div className="access-form-head">
                <span>REQUEST ACCESS</span>
                <b>EMAIL ONLY</b>
              </div>

              <label htmlFor="email">Email address</label>
              <div className="form-row">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength="254"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <button type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Joining…" : "Join early access"}
                  <ArrowRight size={16}/>
                </button>
              </div>

              <div className="honeypot" aria-hidden="true">
                <label>Company<input name="company" tabIndex="-1" autoComplete="off" /></label>
              </div>

              <div className="turnstile-host" ref={challengeRef} />

              <label className="consent">
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/>
                <span>Send me Zugrio product updates and early-access invitations. I can withdraw at any time.</span>
              </label>

              <p className={"form-status " + status} role="status" aria-live="polite">{message}</p>
              <p className="form-fine">No payment, password or broker details required. Joining does not connect a broker or grant trading authority.</p>

              <details className="privacy-mini">
                <summary>Privacy &amp; data use</summary>
                <p>We use your email to manage early access and send the updates you consent to receive. Waitlist records are scheduled for deletion after 12 months unless you withdraw earlier.</p>
                {config?.privacyContact && <p>Questions, access, correction or deletion: <a href={"mailto:" + config.privacyContact}>{config.privacyContact}</a></p>}
              </details>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
