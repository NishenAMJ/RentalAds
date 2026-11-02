# Repository guidance for AI agents

Before changing code or project documentation:

1. Read this file and [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md).
2. Read any more specific `AGENTS.md` that applies to the files being changed. For web app work, this includes `apps/web/AGENTS.md`.
3. Check the current implementation before treating a listed item as unfinished.

Keep `docs/REMAINING-WORK.md` as the canonical cross-project backlog. In the same change that affects a listed task, update its status, scope, dependencies, or notes. Mark work complete only after the implementation is present and the appropriate verification has passed. If a task is waiting for a business decision, credentials, or an operator action, leave it open and state that dependency; do not infer the decision or mark it complete.

Keep `docs/LAUNCH-READINESS.md` and `docs/DEPLOYMENT.md` as explanatory guides, not duplicate task trackers. Link to the canonical backlog when adding checklist references. Do not start unrelated backlog items unless the user asks; this file is a tracking requirement, not blanket authorization.
