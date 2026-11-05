# External document review

`mountEditor` accepts `review`, `onReviewChoice` and `onReviewResult`. The review contains `key`, `beforeSource`, `source`, `mode` (`review` or `readonly`), optional versioned asset maps, candidate choices and table-cell annotations. It uses Milkdown's native diff commands and decorations, not source-line patches. Keep the author document separate; callbacks report the candidate Markdown for a host-confirmed application. Readonly mode prevents review actions and writes.

`acceptReview()` and `rejectReview()` resolve pending changes. `onReviewResult` reports `{key,count,pending,source}`; `onAIStateChange` reports idle/streaming/review. Review state is scoped to each host element. Detached formula proposals have the same KaTeX preview as normal math; tables keep differences in their original cells. Deletion-only controls remain reachable on hover.

`getViewState()` / `restoreViewState()` transfer selection and scroll position. These are not serialized undo history. A host requiring undo across file navigation should retain each mounted editor and hide inactive surfaces; destroy on project teardown.

Validated 2026-11-05 in LaTeX Studio: external three-way proposals, partial and all decisions, tables, equations, versioned images/data, readonly history, real TeX compilation; real Codex acceptance/saving and Claude rejection/preservation. The host retains its own persistence and conflict policy. Existing Node tests: 23 passed; module typecheck and build passed.
