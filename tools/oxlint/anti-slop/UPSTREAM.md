# Provenance

Installed by the `install-anti-slop` Claude Code skill (`~/.claude/skills/install-anti-slop`) on 2026-09-29, via its bundled `scripts/install.mjs`.

- Source: the skill's vendored copy of the anti-slop Oxlint plugin (bundled inside the skill directory, not fetched from a separate upstream repository at install time).
- Installed plugin paths: `tools/oxlint/anti-slop/index.ts` (registered in `.oxlintrc.json`'s `jsPlugins`).
- Dependencies installed: `oxlint@1.86.0`, `@oxlint/plugins@1.86.0` (dev dependencies, pinned exact).
- Deviations from the skill's default instructions: none. All rules enabled at `"error"` per the skill's fresh-install procedure. The Effect plugin was not registered (this project has no `effect` package dependency).

The skill's own provenance record for its bundled copy was not read at install time; if a more precise upstream commit is needed later, re-run the skill's update procedure, which reads that record from the skill source.
