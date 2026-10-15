# Agent implementation, commit, and release workflow

## Before implementation

Read the ticket and linked specifications, inspect the worktree, and identify
pre-existing user changes. Confirm its dependencies with source and verification
evidence. Inspect installed libraries and platform capabilities; apply the
dependency-approval rule in root AGENTS.md, including after a grilling workflow.
An approval already recorded for this task remains valid. Do not turn a routine
implementation detail into repeated permission requests.

For backend tickets, work in the backend repository and read its own instructions.
This frontend planning approval does not waive filesystem permissions or authorize
unrelated backend changes, deployments, commits, or messages to others.

## Implementation completion

Review the final diff, distinguish requested changes from unrelated work, run
relevant verification, and identify material risks/assumptions. Record a concise
ticket summary under `docs/v1/implementation-summary` with the actual result and
checks. Update ticket status only when its acceptance criteria have evidence.

After a full-stack change, start or reuse both frontend and backend servers,
verify that both are reachable, report their local URLs, and keep them running
for manual testing when the environment permits. Report blockers when it does not.
Documentation-only planning does not require inventing application startup commands.

End each implementation task with all seven headings, even for a small change:

### Summary

What was implemented and the intended outcome.

### Changes Made

Important behavioral, architectural, configuration, database, or API changes.

### Files Changed

Each relevant file and why it changed; omit generated files unless they matter
to review. For large changes, group related paths without hiding affected files.

### Verification

Exact tests, typechecks, lint, builds, integration/manual checks run, with each
result. Explicitly name relevant checks that were not run and why.

### Review Notes

Non-obvious logic, tradeoffs, compatibility, edge cases, risks, and assumptions.

### Remaining Issues

Incomplete, deferred, unverified, externally blocked, or risky items. Write
`None.` only when there are none within the delivered scope; distinguish planned
future implementation from an incomplete claim about this milestone.

### Suggested Review Order

The shortest useful order through the changed files/subsystems.

The task is complete only when the diff/verification/risk checks have been
performed or explicitly reported as not performed and every heading is present.

## Commit handoff

For a requested code change modifying tracked files:

1. Inspect the worktree and actual diff; separate requested and pre-existing edits.
2. Partition the requested work into the smallest coherent, independently
   reviewable commits. Each commit has one purpose.
3. Propose an exact Conventional Commit message for each commit, using
   `<type>(<scope>): <description>` where scope helps. Report each commit's files
   and behavioral summary.
4. Ask for explicit final approval before any `git commit`. Approval to implement
   or to write documents is not commit approval.
5. After approval, stage only the intended files/hunks, commit in logical order,
   and report every resulting hash. Never sweep unrelated changes into staging.

For an initial repository, apply the same careful commit proposal to new files.
Do not infer permission to rename/push a branch, merge, or deploy from commit
approval alone. The repository was on unborn `master` during planning; CI targets
`main`, so branch naming must be handled deliberately during scaffold/repository
setup rather than asserted as already done.

## Semantic version tags

When a requested code change is committed and merged into `main`, create an
annotated `vMAJOR.MINOR.PATCH` tag on the resulting intended main commit, following
[Semantic Versioning 2.0.0](https://semver.org/).

Fetch or inspect local and remote tags first. Choose the next stable version from
the actual changes since the latest stable SemVer tag: MAJOR for incompatible
changes, MINOR for backward-compatible functionality, PATCH for compatible fixes.
Use a prerelease identifier only when the user explicitly requests one. If no
stable tag exists, establish and report an appropriate initial version baseline
before releasing; do not fabricate a previous version.

Confirm the merge and required verification succeeded and verify the exact main
target before tagging. Never move, replace, or force-update an existing tag.
Report the version and rationale, create the annotated tag, push it when the
merged main branch is pushed, and report the tag and target commit. No tag, commit,
merge, or push is performed merely because a planning ticket was written.
