# Quality Checklist: Core Grouped Prompt Routing

**Purpose**: Validate whether the current specification is complete, clear, consistent, and review-ready before technical planning
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests the quality of the written requirements, not implementation behavior.

## Completeness and Traceability

- [x] CHK001 Are the qualification rules for a first-level directory to become a prompt group fully specified, including how mixed-content or effectively empty directories are treated? [Completeness, Spec §FR-001, Spec §Assumptions]
- [x] CHK002 Does the spec define how non-markdown files inside a prompt group are handled so authors know whether they are ignored, rejected, or surfaced in diagnostics? [Gap, Spec §FR-002]
- [x] CHK003 Are subcommand naming rules documented for turning nested prompt filenames into operator-visible subcommands, including normalization for spaces, punctuation, or casing? [Gap, Spec §FR-002, Spec §FR-003]
- [x] CHK004 Are description-source requirements complete for groups that lack `_index.md` or have `_index.md` without descriptive metadata? [Completeness, Spec §FR-010, Spec §Edge Cases, Spec §Assumptions]
- [x] CHK005 Are all functional requirements traceable to at least one user story, acceptance scenario, edge case, or success criterion so reviewers can see why each requirement exists? [Traceability, Spec §User Scenarios, Spec §FR-001–FR-014, Spec §SC-001–SC-005]

## Clarity and Measurability

- [x] CHK006 Can "eligible first-level prompt directories" be evaluated objectively, or does the spec need a tighter definition of eligibility? [Measurability, Spec §SC-001, Spec §FR-001, Spec §FR-002]
- [x] CHK007 Is the required "interactive selection experience" specific enough to distinguish mandatory operator behavior from optional UX polish? [Ambiguity, Spec §FR-005]
- [x] CHK008 Is "helpful error" defined with enough precision to judge whether unknown-subcommand feedback is sufficient beyond listing available alternatives? [Clarity, Spec §FR-011, Spec §SC-005]
- [x] CHK009 Is the refresh requirement clear about whether grouped prompt discovery happens only on extension reload or also during other prompt-refresh moments? [Clarity, Spec §FR-014]

## Consistency and Compatibility

- [x] CHK010 Do the duplicate-warning and grouped-vs-flat command conflict rules stay consistent across all sections? [Consistency, Spec §CC-004, Spec §FR-013, Spec §Assumptions]
- [x] CHK011 Are scope-tracking requirements aligned with the commitment to keep user-scoped and project-scoped prompts distinguishable in package-owned UX or diagnostics? [Consistency, Spec §FR-012, Spec §CC-005]
- [x] CHK012 Does the spec consistently define `_index.md` as descriptive or fallback content rather than a runnable nested prompt across all sections that reference grouped behavior? [Consistency, Spec §CC-003, Spec §FR-002, Spec §FR-010]
- [x] CHK013 Are the stated non-goals consistent with the requirements and edge cases around missing prompt arguments, so reviewers can tell what current prompt-template behavior still applies? [Consistency, Spec §NG-001, Spec §FR-007, Spec §Edge Cases]

## Scenario and Edge-Case Coverage

- [x] CHK014 Are acceptance scenarios complete for duplicate-group precedence and flat-command name conflicts, or are those critical cases only described in requirements and compatibility notes? [Coverage, Spec §Acceptance Scenarios, Spec §CC-004, Spec §FR-013]
- [x] CHK015 Are unknown subcommand, empty group, missing metadata, and missing-argument situations all resolved with explicit expected outcomes rather than left as open review questions? [Coverage, Spec §Edge Cases, Spec §FR-005, Spec §FR-011]
- [x] CHK016 Does the spec state whether deeper nested directories are silently ignored, surfaced as author feedback, or otherwise handled so unsupported layouts are unambiguous? [Clarity, Spec §NG-003, Spec §Assumptions]
- [x] CHK017 Are any non-functional expectations for autocomplete responsiveness, discovery scale, or registry growth intentionally excluded, or does this slice need minimal quality thresholds for those operator-facing behaviors? [Gap, Spec §FR-006, Spec §FR-014]

## Notes

- Reviewed against the clarified `spec.md` on 2026-03-31.
- `plan.md` and `tasks.md` now exist, but this checklist still evaluates specification quality rather than implementation behavior.
- All current checklist items pass against the clarified spec as of 2026-03-31.
- Check items off as completed: `[x]`
- Add comments or findings inline when a requirement needs revision.
