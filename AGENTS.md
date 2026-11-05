# AGENTS.md

- Wirtschaftlichkeit (BKP, Erlös, Residualwert) is computed only by `computeWirtschaft()` in `src/lib/wirtschaft-engine.ts`; inputs come from `buildEngineInput()` in `src/lib/wirtschaft-input.ts` and table rows from `src/lib/wirtschaft-rows.ts` — why: card, report and PDF must show identical numbers.
