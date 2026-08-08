# ADR 005: Consumer release orchestration

Status: accepted

`ahk-build release [version]` owns the repeatable local consumer release flow:
Git preflight, optional `package.json` version update, build, asset validation,
release commit, annotated tag, atomic branch/tag push, draft GitHub release,
remote asset verification, and final publication.

`package.json.version` remains the sole version source. A positional release
version updates that file before the build; it is not a second version passed
to compilers or packagers. Omitting the argument uses the committed version and
allows a failed release to resume.

Release requires a clean worktree and an upstream branch that is not behind or
diverged. Tags are signed and verified by default. Remote assets are never
replaced, tags are never rewritten, and pushes are never forced. The command
creates a draft, verifies uploaded sizes and SHA-256 digests, then publishes it.
`--publish-only` retains the previous asset-publication primitive for recovery.

Manual application and installer checks remain an operator responsibility. The
command pauses before Git and GitHub writes unless `--yes` explicitly confirms
that those checks happened elsewhere. Consumer-specific distribution such as
Scoop remains outside the core and may use `afterRelease`.
