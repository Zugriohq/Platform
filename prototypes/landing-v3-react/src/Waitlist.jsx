import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Instagram } from "lucide-react";

const API_BASE = import.meta.env.VITE_WAITLIST_API_BASE || "";

const initialFields = {
  email: "",
  role: "",
  market: "",
  horizon: "",
  mode: "",
  strategy: "",
  platform: "",
};

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
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking signup availability…");
  const [fields, setFields] = useState(initialFields);
  const [consent, setConsent] = useState(false);
  const [config, setConfig] = useState(null);
  const [token, setToken] = useState("");
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
      } catch (error) {
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

  const update = event => setFields(v => ({ ...v, [event.target.name]: event.target.value }));

  function missingProfileFields() {
    return ["role","market","horizon","mode","strategy","platform"].filter(key => !fields[key]);
  }

  async function submit(event) {
    event.preventDefault();
    const missing = missingProfileFields();

    if (missing.length) {
      if (detailsRef.current) detailsRef.current.open = true;
      setStatus("attention");
      setMessage("Complete the short trader profile before joining.");
      requestAnimationFrame(() => document.querySelector('[name="' + missing[0] + '"]')?.focus());
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

    setStatus("submitting");
    setMessage("Submitting your request…");

    const params = new URLSearchParams(location.search);
    const payload = {
      ...fields,
      consent: true,
      token,
      company: "",
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
      setStatus("success");
      setMessage("You’re on the list. We’ll send product updates and early-access invitations as access opens.");
      setFields(initialFields);
      setConsent(false);
      setToken("");
      if (detailsRef.current) detailsRef.current.open = false;
      if (widgetRef.current !== null && window.turnstile) window.turnstile.reset(widgetRef.current);
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

      <form onSubmit={submit} noValidate>
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
            onChange={update}
            placeholder="you@example.com"
          />
          <button type="submit" disabled={status === "submitting" || status === "success"}>
            {status === "submitting" ? "Joining…" : status === "success" ? "Joined" : "Join the waitlist"}
            {status === "success" ? <Check size={16}/> : <ArrowRight size={16}/>}
          </button>
        </div>

        <details className="required-profile" ref={detailsRef}>
          <summary>
            <span><b>Tell us how you trade</b><small>Required · about 30 seconds</small></span>
            <ChevronDown size={16}/>
          </summary>
          <div className="profile-grid">
            <label>Your role
              <select name="role" required value={fields.role} onChange={update}>
                <option value="">Choose</option>
                <option value="independent_trader">Independent trader</option>
                <option value="prop_trader">Prop trader</option>
                <option value="trading_team">Trading team / allocator</option>
                <option value="researcher">Researcher / builder</option>
                <option value="broker_partner">Broker / partner</option>
                <option value="investor">Investor</option>
              </select>
            </label>

            <label>Primary market
              <select name="market" required value={fields.market} onChange={update}>
                <option value="">Choose</option>
                <option value="fx">FX</option>
                <option value="gold">Gold</option>
                <option value="synthetics">Synthetic Indices</option>
                <option value="multiple">Multiple</option>
              </select>
            </label>

            <label>Trading horizon
              <select name="horizon" required value={fields.horizon} onChange={update}>
                <option value="">Choose</option>
                <option value="scalping">Scalping</option>
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="multiple">Multiple</option>
              </select>
            </label>

            <label>Preferred control
              <select name="mode" required value={fields.mode} onChange={update}>
                <option value="">Choose</option>
                <option value="signal">Signal</option>
                <option value="semi_auto">Semi-Auto</option>
                <option value="auto">Auto</option>
                <option value="full_auto_interest">Full Auto interest</option>
              </select>
            </label>

            <label>Method / strategy interest
              <select name="strategy" required value={fields.strategy} onChange={update}>
                <option value="">Choose</option>
                <option value="price_action_apa">Price Action / APA</option>
                <option value="smc">SMC</option>
                <option value="ict">ICT</option>
                <option value="qmr">QMR</option>
                <option value="other">Other / custom</option>
              </select>
            </label>

            <label>Primary platform
              <select name="platform" required value={fields.platform} onChange={update}>
                <option value="">Choose</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="both">Desktop + mobile</option>
              </select>
            </label>
          </div>
        </details>

        <div className="turnstile-host" ref={challengeRef} />

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/>
          <span>Send me Zugrio product updates and early-access invitations. I can withdraw at any time.</span>
        </label>

        <p className={"form-status " + status} role="status" aria-live="polite">{message}</p>
        <p className="form-fine">No payment, password or broker credentials required. Joining does not create a trading account or authorise trading.</p>
      </form>
    </section>
  );
}
