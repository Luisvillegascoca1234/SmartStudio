---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

This project does not use TDD by default. Implement the smallest complete
increment first, then verify its externally observable behaviour at the
pre-agreed seams.

When working from tickets, respect their blocking edges and implement one
ready ticket at a time.

After each increment, run the narrowest relevant verification available. This
may include typechecking, linting, targeted tests, fixture or reference-image
comparisons, manual hardware checks, and performance measurements. Run the
full applicable verification suite once at the end.

Once done, use /code-review to review the work.

Do not commit automatically. Commit only when the user explicitly authorizes
it after reviewing the result.
