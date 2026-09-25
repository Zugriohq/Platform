function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function profileSecret(env) {
  return env.WAITLIST_PROFILE_SECRET || env.TURNSTILE_SECRET || "";
}

export async function createProfileToken(env, email, ttlSeconds = 900) {
  const secret = profileSecret(env);
  if (!secret) return "";

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ email, exp });
  const payloadBytes = new TextEncoder().encode(payload);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), payloadBytes)
  );

  return b64url(payloadBytes) + "." + b64url(signature);
}

export async function verifyProfileToken(env, token) {
  const secret = profileSecret(env);
  if (!secret || typeof token !== "string") return null;

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  try {
    const payloadBytes = fromB64url(payloadPart);
    const signature = fromB64url(signaturePart);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      signature,
      payloadBytes
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!payload?.email || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
