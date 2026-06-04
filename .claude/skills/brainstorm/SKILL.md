---
name: brainstorm
description: Capture a RIGRUNNER ideation / design session into the docs (ideas.md, observations.md, milestones.md, or a spec) on a dedicated branch, ending in a PR — never a direct commit to main. Use whenever Jaco is thinking out loud, riffing on ideas, reacting to the game, firming a design decision, or asking to write up / spec a feature. RIGRUNNER-specific.
---

# brainstorm — capture ideation & design into docs (branch → PR)

Use this for **thinking-and-writing** sessions: brain dumps, "what if", design riffs,
firming a decision, or writing/expanding a spec. It does **not** write game code — pair it
with `implement-feature` when the idea is ready to build.

## The rule this skill exists to enforce

**Never edit docs on `main` directly.** Even docs-only work goes on a branch and lands via a
PR. This avoids stale-branch confusion and races with other merges (see CLAUDE.md → "Git
workflow"). The whole flow below is mandatory, not optional.

## Flow

1. **Start clean, off `origin/main`.** Don't trust the current branch — it may be stale.
   ```sh
   git fetch origin
   git switch -c idea/<short-slug> origin/main   # e.g. idea/energy-systems
   ```
   If the working tree is dirty, stop and resolve that with Jaco before branching.

2. **Classify before writing** (CLAUDE.md → "Capturing what Jaco says"). When unsure, ask,
   and default to the looser bucket:
   - **Raw idea / inspiration / "what if"** → `docs/ideas.md`, under a dated session header,
     in Jaco's voice. Mark it *not committed*.
   - **Concrete finding from playing/building** → `docs/observations.md`.
   - **A candidate that has firmed up enough to aim at** → `docs/milestones.md`.
   - **A real decision / commitment / spec** → update `CLAUDE.md` (source of truth) and/or
     write a dedicated `docs/<feature>-spec.md`. Record the *why*. **State the current truth
     directly — don't frame it against the idea it supersedes** (*"we no longer do X"*, *"unlike
     the old plan"*). The decided docs describe where we *are*; how we got there lives in the dated
     `ideas.md` session + the PR. (This is the **tombstone** smell — see `implement-feature`.)
   - If one message mixes modes, **split it** — firm parts to the decided docs, loose parts
     to ideas/observations.

   The tombstone rule is **only** for the *decided* docs (`CLAUDE.md` / spec). The dated
   `ideas.md` / `observations.md` logs are append-only history — preserving past thinking there
   (even superseded threads) is the whole point, so leave it.

3. **Also capture to the memory store** (per ~/Jaxs/CLAUDE.md) — a `note` tagged
   `brainstorm` + `status:raw` for raw ideas, or a `decision`/`learning` for commitments.
   Use `capture.py insert` with a JSON file (avoid shell-escaping long bodies).

4. **Commit on the branch**, conventional message (`docs(...)`, `idea(...)`). End commit
   messages with the Co-Authored-By trailer.

5. **Push the branch and open a PR** (account `Jaxsbr`):
   ```sh
   git push -u origin HEAD
   gh pr create --fill --base main
   ```
   Tell Jaco the PR link. Do **not** merge unless he asks; he self-merges (no approval
   required by the ruleset).

6. **After merge**, clean up so nothing goes stale:
   ```sh
   git switch main && git pull --ff-only
   git branch -d idea/<short-slug>
   git fetch --prune
   ```

## Don'ts
- Don't enshrine a ramble as committed direction. Raw stays raw in `ideas.md`.
- Don't edit the decided parts of `CLAUDE.md` for a mere idea.
- Don't **tombstone** superseded ideas in the *decided* docs (`CLAUDE.md` / spec) — state the
  present; the dated `ideas.md` log + PR hold the history. (The append-only logs are exempt.)
- Don't commit or push to `main` (the pre-push hook + server ruleset will reject it anyway).
