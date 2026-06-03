# Session: Feature-First `src/` Structure Proposal

> **Subject reviewed:** [`feature-first-structure-proposal.md`](feature-first-structure-proposal.md) (Option B) — the original proposal, archived in this folder.
> **Outcome:** graduated, with alterations, into [**ADR-003**](../../adr-003-feature-first-src-structure.md).
> **Date:** 2026-06-04 · **Part of the [system-review](../README.md) process** — see that README for the
> board method (researchers → synthesizers → reviewers → board).

A multi-agent **review board** was convened to critique the proposal and recommend one of:
**(a)** approve as-is · **(b)** alter · **(c)** alternative direction.

## Verdict

**(b) ALTER Option B — unanimous, high confidence.** Adopt feature-first as the organizing axis
(Jaco's lean is correct); execute it with a small set of alterations that sharpen seams the proposal
already named (resolve the animator tier-inversion first, add path aliases, write+enforce the
`common/` admission rule, write the missing placement rule, scrap-first pilot). None changes Option
B's shape.

➡️ **Read [`board-conclusion.md`](board-conclusion.md) first** — it is the collated verdict, the
agreed alteration payload, the two live disagreements (with resolutions), and the recommended
execution sequence.

## What this session produced

`research → synthesis → review`, run as a background workflow orchestrated from the main thread:

- **`research/`** — 11 artifacts. **6 local-repo** (L1 import-graph reality-check, L2 testability,
  L3 render/animation seam, L4 feature boundaries & the 4 seams, L5 cross-app/shared/build, L6
  roadmap pressure) + **5 web** (W1 feature-vs-layer theory, W2 ECS+Three.js structure, W3 comparable
  game codebases, W4 AI-agent-navigable organization, W5 game-UI-under-growth).
- **`synthesis/`** — 4 briefs collating the research into reviewer-ready arguments: **S-A** evidence &
  migration cost, **S-B** architecture theory & peer practice, **S-C** agent-driven fit, **S-D**
  roadmap & game-design fit. (All four leaned `b-alter`.)
- **`reviews/`** — 3 persona critiques, each casting an a/b/c vote: **R1** AI-Agent Advocate,
  **R2** Human-Friendly Software Architect, **R3** Experienced Indie Game Developer. (All three: `b`.)
- **`board-conclusion.md`** — the orchestrator's collation and final recommendation.

## Reading order

1. [`board-conclusion.md`](board-conclusion.md) — the answer + the plan.
2. The three [`reviews/`](reviews/) — the persona arguments behind the vote.
3. The four [`synthesis/`](synthesis/) briefs — the reasoning the reviewers built on.
4. [`research/`](research/) — the raw evidence (read a specific one when you want the receipts).
