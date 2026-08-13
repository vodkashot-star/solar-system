---
description: Any change to the project must update CHANGELOG.md under [Unreleased]
---

# Changelog Rule

Every change to tracked project files (code, npm scripts, opencode config/agents/skills/commands/rules, docs, GLB assets, ML models) MUST add an entry to `CHANGELOG.md` under `## [Unreleased]`.

Requirements:

- Add a `### <Theme>` subsection (Feature / Bug fix / Refactor / Tooling / Hosting / Cleanup / Docs) if one doesn't exist yet, then bullets under it
- Each bullet: what changed + where (file paths) + why it matters
- Update the date in the `## [Unreleased] — YYYY-MM-DD` header to today when adding entries
- A change with no changelog entry is incomplete — finish CHANGELOG.md before declaring the task done
- For multi-file features, one subsection covering the whole feature is enough (no per-file noise)
