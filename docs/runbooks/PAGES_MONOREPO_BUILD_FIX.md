# Keep the landing site building once the monorepo reaches `main`

Owner dashboard change. Needed before PR #67 merges. Recorded 2026-10-07.

## What breaks, proven by probe

The Cloudflare Pages project `zugrio` builds the landing site (`prototypes/landing-v3-react`, its own npm `package-lock.json`). On 2026-10-07 temporary branches were pushed, each `main` plus a subset of the alpha's root files:

| Root files added to `main` | Pages build |
|---|---|
| `package.json` only | success |
| `pnpm-workspace.yaml` only | success |
| `pnpm-lock.yaml` only | success |
| `pnpm-workspace.yaml` + `pnpm-lock.yaml` (+ `package.json` without `packageManager`) | **failure** |
| all three, as on PR #67 | **failure** |

With a pnpm workspace and its lockfile at the repository root, Pages' automatic dependency install treats the repository as a pnpm monorepo. It does not install the landing site's own npm dependencies, so the build fails. Locally the same missing install gives `vite: not found`. The Pages build log itself was not read; the probe table is the evidence.

PR #67 adds both files to `main`. After it merges, **every landing build, production included, would fail** until this is fixed. The site already deployed stays up, but no update could ship.

## The fix (Cloudflare dashboard, about 3 minutes)

Workers & Pages → **zugrio** → **Settings**.

1. **Build configuration → Edit.** Note the current **Root directory** first.
   - If Root directory is `prototypes/landing-v3-react` (as `CLOUDFLARE_WAITLIST_SETUP.md` documents): set **Build command** to
     `npm ci && npm run build`
   - If Root directory is empty (repository root): set **Build command** to
     `cd prototypes/landing-v3-react && npm ci && npm run build`
     and leave the output directory as it is.

   Change nothing else. This command works with or without the next step, so production is safe either way.
2. **Variables and Secrets → Add**, environment **Preview** only, first:
   `SKIP_DEPENDENCY_INSTALL` = `1`
   This turns off Pages' automatic install; the build command does the npm install instead.
3. Tell Claude. Claude pushes to PR #67; its **Cloudflare Pages** check must turn green.
4. Then add the same variable for **Production**. Do this before PR #67 merges.

## Verification

- The PR #67 Cloudflare Pages check passes.
- A landing PR still builds.
- After the Production variable is set, the next production deployment succeeds and https://zugrio.xyz is unchanged.

## Rollback

Delete `SKIP_DEPENDENCY_INSTALL` and restore the old build command (most likely `npm run build`).
