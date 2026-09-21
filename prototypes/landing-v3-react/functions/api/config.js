export async function onRequestGet(context) {
  const env = context.env;
  const ready = Boolean(
    env.TURNSTILE_SITE_KEY &&
    env.TURNSTILE_SECRET_KEY &&
    env.WAITLIST_DB
  );

  return Response.json(
    {
      ready,
      siteKey: ready ? env.TURNSTILE_SITE_KEY : null,
      privacyContact: env.PRIVACY_CONTACT || null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
