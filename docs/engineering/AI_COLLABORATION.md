# AI Collaboration Contract

## Roles

- **Founder / Product Owner:** owns product intent, user value, prioritization, acceptance criteria and material tradeoffs.
- **Implementing agent:** works from a GitHub issue and produces a branch/PR with evidence.
- **Reviewing agent:** adversarially reviews the diff, tests and architecture impact.
- **CI:** objective merge gate.
- **Future senior engineer:** human technical owner and final reviewer for capital-critical production changes.

## Shared context

All agents read the same repository context. Conversation memory is never assumed.

## Work protocol

One GitHub issue = one bounded objective. One agent owns the implementation branch at a time. A second agent reviews the PR/diff; it does not concurrently rewrite the same files.

Every session should leave durable knowledge in code, tests, docs, ADRs, issue comments or PR history.

## Prohibited behaviors

- direct AI push to protected `main`;
- shared personal access tokens;
- disabling tests to make CI green;
- `--no-verify` to bypass safety hooks;
- force-push to shared protected branches;
- architecture changes hidden inside bug fixes;
- fabricated measurements/evidence;
- capital-path merge solely because multiple AI systems agree.
