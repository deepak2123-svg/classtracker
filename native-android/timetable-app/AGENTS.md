# AGENTS.md — operating rules for whoever (human or AI) builds the Ledgr Timetable App

These rules exist so the agent never has to guess how to behave. They sit
above the spec (`ledgr-timetable-app-roadmap.md`) and the ticket plan
(`ledgr-timetable-app-build-plan.md`) — read those for *what* to build; this file is *how*.

## 1. The spec is the source of truth, not the code

If the code and `ledgr-timetable-app-roadmap.md` ever disagree, the spec wins.
If a ticket asks for something the spec doesn't cover, **stop and ask** —
do not invent a product decision. Inventing an *implementation* detail
(a variable name, a package structure, which Compose modifier to use) is
fine and expected. Inventing a *product* decision (what a field means,
whether something is shared or per-timetable) is not — that's exactly the
kind of silent assumption this whole project has been trying to avoid.

## 2. One ticket at a time, nothing extra

Build exactly what the current ticket's acceptance criteria describe. Do
not add configuration options, abstraction layers, or "while I'm here"
improvements that weren't asked for. If a ticket seems to need something
the spec doesn't mention (a new field, a new screen), that's a stop-and-ask
moment, not a build-it-anyway moment. Scope creep on an AI-built codebase
is the single most common failure mode — resist it by default.

## 3. Tests before implementation, wherever logic exists

For any ticket involving a calculation, a conflict check, a query, or a
transformation (not pure UI layout) — write the test first, watch it fail,
then implement until it passes. The reporting date-range math (Bucket 5)
and the conflict-detection logic (Bucket 2) are the two places this matters
most in this codebase; treat those especially strictly.

## 4. "Done" means verified, not written

A ticket is not complete when the code is written — it's complete when:
- it builds with no errors,
- its own acceptance criteria all pass,
- every previously-passing test still passes (no regressions),
- and it was actually run, not just read back.

Never report a ticket as done from code inspection alone. Run it.

## 5. Never leave a ticket half-finished and silent

If a ticket turns out to be blocked — ambiguous spec, missing dependency,
a decision only the product owner can make — say so explicitly and name
the exact question that would unblock it. Don't ship a partial
implementation that quietly papers over the gap with a guess.

## 6. Keep a running log

After each completed ticket, append one line to `PROGRESS.md`: the ticket
ID, what was built, and what (if anything) was assumed. This is what lets
anyone — human or a different agent session — pick this project back up
without re-deriving context from scratch.

## 7. Order matters

Work through the buckets in `ledgr-timetable-app-build-plan.md` in order. Later buckets
assume earlier ones exist (Reporting assumes the wizard can already
produce real `Timetable` rows; Export assumes Reporting's queries exist).
Don't jump ahead because a later bucket looks more interesting.
