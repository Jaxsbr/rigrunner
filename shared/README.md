# shared/  (placeholder)

Modules used by **both** the prototype and the production game live here. Empty for now.

Rule: sharing is **explicit, never implicit**. `prototype/` and `game/` never import directly from
each other — anything both need is promoted into `shared/` deliberately. During Phase 1 you can
mostly ignore this directory; it matters once Phase 2 starts and we decide what (if anything) from
the prototype is worth keeping verbatim.
