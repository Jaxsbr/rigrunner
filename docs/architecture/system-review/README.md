# System Review — the Review-Board process

This directory is the **root for multi-agent "review board" sessions**. A session takes one thing that
needs a hard, well-reasoned look — a proposal, a PR, a design doc, a subsystem, or an open question —
runs a fan-out of research → synthesis → independent persona reviews, and lands a **recommendation**
with every artifact of reasoning preserved.

Each session lives in its **own dated subdirectory**, so the history of what was reviewed (and why we
decided what we did) stays readable over time.

---

## How to start a new review

Point the orchestrator at **this directory as the output root** and hand it **the thing to review** —
that's all that changes session to session. For example:

> "Have a review board critique `<path-or-PR-or-question>`. Use `docs/architecture/system-review` as
> your output root."

The orchestrator will:

1. **Ground itself** in the project first — `CLAUDE.md`, the relevant `docs/` (ideas, milestones,
   observations, ADRs, specs), the memory store, and the real code the subject touches — and assemble a
   short **verified-facts brief** so the board argues from ground truth, not from the subject's own claims.
2. **Create a new session subdirectory** named `YYYY-MM-DD-<slug>` (see naming below).
3. **Run the board** (the method below) and write the **board conclusion** + a brief.

You do not need to specify the researchers, synthesizers, or reviewers unless you want to — the
orchestrator scopes the pools to the subject. You *can* tailor them (e.g. "add a security reviewer",
"focus the research on rendering").

---

## The board (roles)

| Role | Who / how many | Job |
|---|---|---|
| **Orchestrator** | the main thread (you're talking to it) | Grounds in project history, designs & runs the board, reads everything back, writes the **board conclusion** and the chat brief. Stays in the loop between phases. |
| **Researcher pool** | many, no fixed limit | Each takes one angle and writes a **research artifact**. Split between **local-repo** researchers (verify claims against the real code, map boundaries, measure cost/risk) and **web** researchers (industry practice, comparable work, techniques). Run on a fast model for breadth. |
| **Synthesizer pool** | one per review **area** | Each owns a main area, **reads the research and collates it into a reviewer-ready brief** — the document the reviewers actually lean on. Run on the strong model (judgment concentrates here). |
| **Reviewer panel** | a small set of **personas**, each a distinct lens | Each independently critiques the subject and **casts a decision vote**, free to dissent. Personas are chosen to fit the subject (the 2026-06-04 session used *AI-Agent Advocate*, *Human-Friendly Architect*, *Indie Game Developer*). Strong model. |

**Phases run `research → synthesis → review`**, with a barrier between each (synthesizers need the full
research set; reviewers need the full synthesis set). The orchestrator then collates the votes, surfaces
any dissents honestly, and recommends.

## The decision frame

Reviewers each pick one outcome and justify it. The default frame (tune the wording to the subject):

- **(a) Approve as-is** — and say why it holds up.
- **(b) Alter** — approve the direction, but list the exact changes and why.
- **(c) Alternative** — a diverging direction, with reasoning for the divergence.

The board conclusion states the collated verdict, the agreed change payload (if any), the genuine
disagreements with the orchestrator's resolution, and a concrete next step.

---

## Per-session directory layout

```
system-review/
  README.md                      # this file — the process (don't put session content here)
  YYYY-MM-DD-<slug>/             # one self-contained session
    README.md                    # session index: subject, verdict, reading order
    board-conclusion.md          # the orchestrator's collated verdict + plan (read this first)
    research/                    # L* local-repo + W* web research artifacts
    synthesis/                   # S-* reviewer-ready briefs, one per area
    reviews/                     # R* persona critiques, each with an a/b/c vote
```

**Naming:** `YYYY-MM-DD-<slug>`, where `<slug>` says what was reviewed in a few words
(e.g. `2026-06-04-feature-first-src-structure`). Date first so sessions sort chronologically.

**Conventions:** artifacts cite real file paths / real URLs; the orchestrator feeds every agent the same
verified-facts brief so the board doesn't relitigate ground truth; research uses a fast model, synthesis
and review use the strong model.

---

## Sessions

| Date | Subject | Verdict | Session |
|---|---|---|---|
| 2026-06-04 | Feature-first `game/src/` structure proposal (Option B) | **(b) Alter** — adopt the axis with a defined payload → graduated into [ADR-003](../adr-003-feature-first-src-structure.md) | [`2026-06-04-feature-first-src-structure/`](2026-06-04-feature-first-src-structure/) |
