---
title: "Reference/YouTube Note Consolidation - Plan"
type: fix
date: 2026-10-30
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Reference/YouTube Note Consolidation - Plan

**Target repo:** youtube-transcripts-mcp (`/home/jandal/Projects/MCP/youtube-transcripts-mcp`). This plan also touches the Obsidian vault at `/home/jandal/Documents/Obsidian/METJM/`, which is a fixed single-machine location outside any repo and not under version control — those paths are necessarily absolute throughout this plan.

---

## Goal Capsule

- **Objective:** Using the YouTube note tool consistently produces a note in the right place with the right name, so the vault stops needing manual cleanup afterward.
- **Means:** Stop the MCP server from hardcoding `Media/YouTube/`, point its defaults and fallback at `Reference/YouTube/`, delegate topic-folder choice to the vault's own convention (KTD1), fix the stale skill-extraction path that caused permanent fallback (KTD2), and migrate the 58 existing files to match (KTD4, KTD5).
- **Authority hierarchy:** Requirements (Product Contract) constrain Key Technical Decisions; KTDs constrain Implementation Units; no unit may narrow a requirement.
- **Stop conditions:** Never invent a new `Reference/` subtopic folder. Never change `process-youtube-captions` or `Transcripts/yt/` behavior. Never auto-merge or delete a duplicate-titled note. Never run the migration's apply step without the user reviewing the proposed mapping first.
- **Execution profile:** Single-developer repo, no CI gate beyond `npm run build` / `npm test`. The vault-side migration (U4) is a human-supervised operational step, not something to run unattended.
- **Who finishes:** The implementer lands U1 and U3 as ordinary repo code changes and commits them, edits the vault's `_vault-structure.md` directly for U2 (not a repo commit — the vault has no version control), then runs U4 interactively with the user's explicit approval before any vault file moves.

---

## Product Contract

### Summary

Change the YouTube MCP server's note-creation default from `Media/YouTube/` to `Reference/YouTube/`, let topic-matching notes land in their existing `Reference/<Topic>/` subfolder instead, fix the skill-extraction bug that silently froze the server's instructions on a years-stale template, and migrate the 55 files in `Media/YouTube/` plus the 3 already in `Reference/YouTube/` to match — all without touching the already-correct `Transcripts/yt/` behavior.

### Problem Frame

The server currently defaults new YouTube notes to `Media/YouTube/` with no date normalization guarantee and no topic sorting. That default was itself a deliberate pivot made on 2026-09-07 (see `.kilo/plans/1788792894235-summary-note-auto-fixes.md`, commits `1c72868`/`7170f3c`) away from the tool's original `Reference/` destination — at the time, `Media/YouTube/` was "the skill's live YouTube folder" and `Reference/YouTube/` was unused. Since then the user's own vault convention evolved: `Reference/Technology/`, `Reference/Finance/`, and other `Reference/` subtopics now routinely hold YouTube-sourced notes filed by subject, and the user now wants YouTube notes to follow that same topic-based filing rather than sit in one undifferentiated folder.

Separately, the obsidian-note-creator skill was restructured to version 3.2.0: folder-location data moved out of `SKILL.md`'s old "Common Folder Locations" table into a per-vault `_vault-structure.md` file. The MCP server's `skill-extractor.ts` was never updated for that move — it still regexes `SKILL.md` for the now-nonexistent table, that lookup always fails, and the failure discards the otherwise-still-valid frontmatter/field-rule/template sections it did extract, forcing the server onto its frozen fallback text every time. The vault's current `_vault-structure.md` also still says the opposite of what's wanted: `Media/YouTube/` is marked "active," `Reference/YouTube/` is marked "legacy — do not add new notes there."

### Requirements

**Server behavior (going forward)**
- R1. New notes from `create-youtube-summary-note` default to `Reference/YouTube/` instead of `Media/YouTube/`.
- R2. The bundled instructions route each note to the existing `Reference/<Topic>/` subfolder that clearly matches its content, falling back to `Reference/YouTube/` otherwise, without asking the user anything.
- R3. The ISO-dated filename format `YYYY-MM-DD_HHMM-kebab-title.md` is unchanged — carried forward, not reworked.
- R4. `process-youtube-captions` and the `Transcripts/yt/` folder/filename behavior are unchanged.

**Skill and documentation consistency**
- R5. The server's bundled formatting instructions stay usable against the live `obsidian-note-creator` skill instead of silently falling back whenever the skill's folder-location format changes.
- R6. `_vault-structure.md` reflects the new convention: `youtube-transcript` maps to `Reference/YouTube/` (or a matching subtopic), `Reference/YouTube/` is no longer marked legacy, and `Media/YouTube/` is marked superseded.

**Migration**
- R7. Every file currently in `Media/YouTube/` and the 3 pre-existing files in `Reference/YouTube/` end up under `Reference/YouTube/` or a matching `Reference/<Topic>/` subfolder, with a filename matching the canonical `YYYY-MM-DD_HHMM-kebab-title.md` pattern.
- R8. The one stray raw-transcript `.txt` file in `Media/YouTube/` moves to `Transcripts/yt/`, not treated as a note.
- R9. No note content is lost, overwritten, or silently merged during migration, including near-duplicate-titled files.
- R10. The migration is reviewable — a proposed mapping exists for the user to approve — before anything changes on disk.

### Key Decisions

- **Topic-based filing over one flat bucket.** `Reference/YouTube/` is the catch-all, not the only destination; a note whose subject clearly matches an existing `Reference/<Topic>/` folder goes there instead. Governs R2, R7. (session-settled: user-directed — chosen over keeping every YouTube note in one folder: the user explicitly asked to preserve the subtopic structure they already use in `Reference/Technology/`, `Reference/UI/`, etc.)
- **No new subtopics invented during migration.** Only folders that already exist under `Reference/` are migration targets. Governs R7. (session-settled: user-directed)

### Scope Boundaries

**Out of scope:**
- Changing `process-youtube-captions` or `save-formatted-transcript` (R4).
- Cross-platform skill discovery (Windows/macOS paths) — Linux only, inherited from the original tool plan.
- Deduplicating or merging near-duplicate-titled notes (e.g. the three onion-chopping notes) — flagged for the user, not resolved automatically.
- Sorting YouTube notes into vault-root topic folders outside `Reference/` (e.g. `Recipes/`, `Music/`, `Gaming/`) — only existing `Reference/` subtopics are migration targets.

#### Deferred to Follow-Up Work

- Backfilling video metadata (channel, published date) into migrated notes' `## Video Details` sections.

### Open Questions

Document review verified two scope-affecting facts not known when this plan was first written:

- **A third repo actively overrides this server's output and already causes the exact misfiling this plan migrates away from.** `/home/jandal/Projects/MCP/omatube-captions` (confirmed present on this machine) calls this MCP server but its `scripts/claude-prompt-template.txt` explicitly instructs: "Override the tool's formatting instructions" and "Do NOT use the tool's suggested filename," writing a `type: reference` note with a non-date-prefixed Title-Case filename flat into `NOTES_DIR` (defaulting to `Reference/`, not `Reference/YouTube/`). Its `process-youtube-url.sh` also watches that directory with a non-recursive `inotifywait`, so a note written into a subfolder would never be detected as complete. R1-R6 change this server's own defaults and bundled instructions, but this caller bypasses all of them — so new notes in the old misfiled shape will keep appearing after this plan ships, regardless of U1/U2, unless `omatube-captions` is also updated. **Decide:** bring `omatube-captions`'s prompt template and watch mechanism into this plan's scope, or explicitly accept that the stated Objective ("the vault stops needing manual cleanup afterward") holds only for the `create-youtube-summary-note` path and not for this caller.
- **9 additional youtube-tagged, `type: reference` notes already sit loose directly in `Reference/` root** (not in `Media/YouTube/` or `Reference/YouTube/`, so outside R7's current scan scope) — confirmed by filename and frontmatter: `AI Generated Code Quality - DHH vs Bjarne Stroustrup.md`, `AI Model Fatigue and Programming in the Age of AI Assistance.md`, `Civilisation Collapse and the End of the Petrodollar - Professor Jiang.md`, `Global Collapse Predictions and the Petrodollar System - Professor Jiang.md`, `Gamescope - Steam Deck Session Mode vs Desktop Compositor.md`, `How Puzzles Affect the Brain - Neurology Expert.md`, `Puzzles and Brain Function - Neurology Expert.md`, `I Quit Claude Code - Jordan Erbs.md`, and `University Challenge S56E01 Bristol vs Imperial.md` — these are the output of the `omatube-captions` caller above, including two near-duplicate pairs (the two Professor Jiang petrodollar notes; the two neurology/puzzles notes). **Decide:** widen U3's scan to also inventory these loose `Reference/`-root files (same flag-not-merge treatment as the onion-chopping cluster already in scope), or explicitly leave them as a separate, acceptable format.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Delegate folder choice to the vault's own convention instead of a server-side classifier.** The bundled instructions tell Claude to read `_vault-structure.md` and pick the matching `Reference/<Topic>/` subfolder, defaulting to `Reference/YouTube/`. Rationale: this is exactly what the `obsidian-note-creator` skill's normal workflow already does for every other note type (Workflow step 5: "picking the closest matching folder"); YouTube notes just stop bypassing it. Building a second, server-side topic classifier would duplicate that judgment and drift from it. (session-settled: user-directed — chosen over a server-computed topic field, instantiating the Key Decision above)
- KTD2. **Remove the `folderRow` extraction requirement from `extractInstructionsFromSkill`; make folder guidance a fixed instruction, not an extracted one.** The skill moved folder-location data to `_vault-structure.md` in v3.2.0; `SKILL.md`'s "Common Folder Locations" table no longer exists, so the current `folderRow` regex always fails and discards the frontmatter/field-rules/template sections that *do* still extract correctly. Decoupling folder guidance from the extraction gate fixes live extraction for those three sections and removes the single point of silent, permanent staleness. Governs R5.
- KTD3. **`Reference/YouTube/` replaces `Media/YouTube/` as the hardcoded default/fallback** in the tool schema, the tool handler, and `FALLBACK_NOTE_INSTRUCTIONS`. Governs R1.
- KTD4. **Migration runs copy-then-verify-then-delete, never a raw rename, gated by an explicit human approval of a generated manifest.** The vault has no git history to recover from a bad move (confirmed: `/home/jandal/Documents/Obsidian/METJM/` is not a git repository). Governs R9, R10.
- KTD5. **Existing-file topic assignment uses conservative title/keyword matching against existing `Reference/` subtopic names only; anything not a clear match lands in `Reference/YouTube/`; duplicate-titled clusters are flagged, not merged.** Governs R7, R9. (session-settled: user-directed — chosen over inventing new subfolders or auto-deduplicating: the user asked to keep existing subtopics and never asked for deduplication)
- KTD6. **Dates for the 17 undated existing files are sourced from the file's own `created:` frontmatter field when present and parseable, falling back to filesystem mtime only when no usable frontmatter date exists.** Verified mtime-only would be wrong by a material margin for at least 3 files (e.g. one file's `created: 2025-03-25` versus an mtime over a year later) since mtime reflects when a batch of notes was last touched on disk, not when each was written; the frontmatter date already sits in the same file the script opens for topic matching, costing nothing extra to read. Governs R7. (session-settled: user-directed — the mtime-vs-frontmatter choice was refined during document review; the underlying decision to avoid re-fetching each video's publish date stays as the user directed)

### Assumptions

- `omatube-captions` overrides this server's defaults entirely, so R1's default-folder change has no effect on notes that caller produces — see Open Questions for the scope decision this requires.
- The uncommitted `en-orig` caption-download fix already present in this repo's working tree (`youtube-downloader.ts`) is unrelated prior work from earlier in this session and is not part of this plan's units; it should be committed on its own.

---

## Implementation Units

### U1. Decouple note-folder instructions from the stale skill extraction; default to `Reference/YouTube/`

**Goal:** Fix the extraction bug (KTD2) and the hardcoded destination (KTD3) in one pass, since both live in the same instruction-assembly code path.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**
- `skill-extractor.ts`
- `youtube-tools.ts`
- `tests/skill-extraction.test.ts`

**Approach:**
1. In `skill-extractor.ts`'s `extractInstructionsFromSkill`, remove the `folderRow` match and its `if (!folderRow) return null;` gate — folder guidance stops being an extracted field.
2. Reword `AUTOMATION_HEADER` and every `**Target Folder**: <path>` line (in both the live-extraction output and `FALLBACK_NOTE_INSTRUCTIONS`) so only the *filename* is mandated exactly. `AUTOMATION_HEADER` currently also locks the directory ("Use the target directory ... EXACTLY as given ... Do NOT rename, reformat, or shorten the filename") — drop the directory half of that sentence, keep the filename-exact half, and add the folder-guidance instruction in its place: read `_vault-structure.md` at the vault root, use the matching `Reference/<Topic>/` subfolder when the video's subject clearly fits one, otherwise use `Reference/YouTube/`, per KTD1.
3. In `youtube-tools.ts`'s `create-youtube-summary-note` handler, replace the response's `**Required Note Path (save the note to EXACTLY this path, do not rename):** ${outputDir}/${suggestedFilename}` line — which hardcodes one fixed directory and currently overrides step 2's folder guidance — with text that states the fixed suggested filename and presents `outputDir` only as the default/fallback folder, deferring the actual folder choice to the bundled folder-guidance instruction from step 2.
4. Replace the remaining `Media/YouTube` defaults with `Reference/YouTube` in `youtube-tools.ts`'s tool schema description/default for `create-youtube-summary-note`, per KTD3.
5. Update `tests/skill-extraction.test.ts`'s `SAMPLE_SKILL_CONTENT` fixture to drop the "Common Folder Locations" table (matching the real v3.2.0 skill shape) and update assertions for the new filename-only enforcement wording and folder-guidance text.

**Patterns to follow:** the existing try/catch-never-throw pattern in `skill-extractor.ts`; the existing stderr logger pattern.

**Test scenarios:**
- Happy path: skill content shaped like the current real `SKILL.md` (frontmatter, field rules, `youtube-transcript` template, no folder table) → extraction succeeds (previously returned `null`) and includes the folder-guidance instruction.
- Fallback path: skill file missing → `FALLBACK_NOTE_INSTRUCTIONS` returned, contains `Reference/YouTube/` and the folder-guidance instruction, never `Media/YouTube`.
- Regression: content with no `youtube-transcript` section at all → still returns `null` / falls back, unchanged from current behavior.
- `create-youtube-summary-note`'s assembled response text mandates the exact filename but no longer mandates one exact full note path; the folder is presented as a default, not a requirement.
- `AUTOMATION_HEADER`'s text no longer contains "Use the target directory ... EXACTLY as given," so it cannot override the folder-guidance instruction added in step 2.

**Verification:** `npm test` passes with the updated fixture; `npm run build` succeeds; a manual tool call confirms the response text contains no `Media/YouTube` reference.

---

### U2. Update `_vault-structure.md` to match the new convention

**Goal:** Make the vault's own authoritative folder-mapping document agree with R1/R2 instead of contradicting them, per KTD1 and R6.

**Requirements:** R6

**Dependencies:** None (independent of U1; both should land before U4 runs)

**Files:**
- `/home/jandal/Documents/Obsidian/METJM/_vault-structure.md` (vault-absolute, outside this repo)

**Approach:**
1. In "Key Subfolders," remove the `Media/YouTube/` "(active — use this, not `Transcripts/`)" annotation; add `Reference/YouTube/` as the YouTube catch-all.
2. In "Note Type → Folder Mapping," change the `youtube-transcript` row from `Media/YouTube/` to `Reference/YouTube/ (or the matching Reference/<Topic>/ subfolder when the video clearly fits one)`.
3. In "Important Notes," remove the line marking `Reference/YouTube/` legacy; add a line marking `Media/YouTube/` superseded — existing notes there are being migrated out, don't add new ones there.
4. Bump the `last-updated` frontmatter field to today's date.

**Test expectation:** none — documentation file, not executable; verified by review.

**Verification:** re-read the file after editing; confirm no remaining line calls `Media/YouTube/` "active" or `Reference/YouTube/` "legacy."

---

### U3. Build the one-time migration script: manifest generation + guarded apply

**Goal:** Produce the reviewable mapping R10 requires and the safe-apply mechanism KTD4 requires.

**Requirements:** R7, R8, R9, R10

**Dependencies:** U1, U2 (migration should target the already-updated convention)

**Files:**
- `scripts/migrate-youtube-notes.ts` (new)
- `tests/migrate-youtube-notes.test.ts` (new)
- `tsconfig.json`

**Approach:**
1. Manifest mode (default, no filesystem changes): scan `Media/YouTube/` and the existing `Reference/YouTube/` files. For each, compute a proposed target folder (match title keywords against existing `Reference/` subtopic names only — Technology, Finance, DND, UI, Equipment, Laptop, Guides — else `Reference/YouTube/`, per KTD5), a proposed canonical filename (`YYYY-MM-DD_HHMM-kebab-title.md`, reusing an existing filename date prefix when present and parseable, else the file's `created:` frontmatter date when present and parseable, else the file's mtime per KTD6), and a `duplicate-cluster` flag when another entry's normalized title closely matches. Route the one stray raw `.txt` transcript to a `Transcripts/yt/` destination instead of a Reference target, per R8.
2. Collision guard: when two entries resolve to the identical target path, append a short disambiguating suffix to all but the first rather than overwriting.
3. Apply mode (explicit flag, consumes the reviewed manifest): for each entry, copy the file to its target path, verify the copy is byte-identical to the source, then delete the source only after verification succeeds. On verification failure, leave the source in place and mark the entry failed. Create target directories as needed; never create a new top-level or new `Reference/` subtopic folder.
4. Write a migration log (old path, new path, outcome) for every entry to a fixed report file, per KTD4.
5. Widen `tsconfig.json`'s `include` from `["*.ts"]` to also cover `scripts/**/*.ts` — the current glob is non-recursive and would leave `tsc` never checking the new script. Invoke the compiled script directly with plain `node` (e.g. `node build/scripts/migrate-youtube-notes.js [--apply]`) after `npm run build`, matching the project's existing no-extra-runtime-dependency convention (no `ts-node`/`tsx` installed).

**Patterns to follow:** `file-manager.ts`'s `fs.promises` + UTF-8 pattern; keep the script dependency-free (Node builtins only), matching the server's self-contained design.

**Test scenarios:**
- Clear topic match: a title containing "DaVinci Resolve" → manifest proposes `Reference/Technology/` with a normalized ISO filename.
- No topic match: a title with no subtopic keyword → manifest proposes `Reference/YouTube/`.
- Undated existing file: no date prefix in the current filename, but a parseable `created:` frontmatter date → manifest sources the date from frontmatter, not mtime.
- Undated existing file with no usable frontmatter date either → manifest falls back to mtime.
- Duplicate cluster: multiple files with closely matching normalized titles (e.g. the three onion-chopping notes) → all flagged as one duplicate cluster, none merged or dropped.
- Target collision: two entries resolve to the same target path → the second gets a disambiguating suffix, not an overwrite.
- Stray `.txt`: the raw-transcript file → manifest routes it to `Transcripts/yt/`, not a Reference folder.
- Apply-mode integrity: after apply, the copied file's content hash matches the original; the original is deleted only after that verification passes.
- Apply-mode failure path: a simulated verification mismatch → source file stays in place, entry marked failed in the migration log.

**Verification:** the script's tests pass; a dry run against the real `Media/YouTube/` folder produces a manifest covering all current files with no entry left unclassified.

---

### U4. Review the manifest and execute the migration

**Goal:** Carry out R7-R10 on the real vault data under explicit human approval.

**Requirements:** R7, R8, R9, R10

**Dependencies:** U3

**Files:** none — this is the operational run of U3's script, not new code.

**Approach:**
1. Run manifest mode; present the full proposed mapping, including every flagged duplicate cluster, to the user for explicit approval before any file moves.
2. On approval, run apply mode.
3. Spot-check the result: file counts before and after match (minus the one `.txt` that moved to `Transcripts/yt/`), every source file is accounted for in the migration log as moved or explicitly flagged, and every file now under `Reference/YouTube/` or a matched subtopic folder uses the canonical filename pattern.

**Execution note:** do not run apply mode until the user has explicitly approved the manifest — this changes the user's personal vault with no version-control safety net, per KTD4.

**Test expectation:** none — human-gated execution of U3's already-tested script, not new code.

**Verification:** the migration log shows every source file resolved (moved or flagged, never silently skipped); `Reference/YouTube/` and the touched subtopic folders contain only canonically-named files; `Media/YouTube/` is empty.

---

## System-Wide Impact

- **MCP server contract:** `create-youtube-summary-note`'s default output directory changes (R1). The only known external caller, `omatube-captions`, is unaffected either way since it overrides `outputDir` and every other instruction explicitly — see Open Questions for whether that caller itself should change.
- **Shared skill convention:** `_vault-structure.md` (U2) is read by the general-purpose `obsidian-note-creator` skill for every note type, not just this server's output — the change makes this server's behavior agree with that shared convention rather than fighting it.

---

## Risks & Dependencies

- **Risk:** `omatube-captions` (confirmed present at `/home/jandal/Projects/MCP/omatube-captions`) does not assume `Media/YouTube/` — it explicitly overrides this server's folder, filename, and note-type instructions entirely and writes flat into `Reference/` root, which is the confirmed source of the 9 loose files surfaced in Open Questions. **Mitigation:** see Open Questions — this needs a scope decision, not a mitigation this plan can apply unilaterally.
- **Risk:** Title-keyword topic matching (U3) will misclassify some of the 58 files, or classify almost none confidently. **Mitigation:** conservative-match-or-catch-all design (KTD5) means a wrong guess costs a slightly-too-generic placement in `Reference/YouTube/`, never a wrong subtopic; the manifest review step (U4) catches this before anything moves.
- **Dependency:** U4 depends on the user's own availability to review and approve the manifest — not something `ce-work` should run unattended.

---

## Verification Contract

| Command | Applies to | Gate |
|---|---|---|
| `npm run build` | U1, U3 | Must succeed with no type errors; confirm `scripts/migrate-youtube-notes.ts` actually appears under `build/scripts/` (proof `tsconfig.json`'s widened `include` reached it) |
| `npm test` | U1, U3 | All tests green, including new/updated fixtures |
| Manual tool call: `create-youtube-summary-note` on a clear-topic-match video and a no-match video | U1 | Response text contains no `Media/YouTube` reference; folder guidance text is present |
| Restart or reconnect the MCP server (`/mcp` reconnect, or restart the host) after rebuild | U1 | Required before the new behavior takes effect live — this server runs as a long-lived stdio process that does not hot-reload |

---

## Definition of Done

- U1 and U3 merged with `npm run build` and `npm test` green.
- `_vault-structure.md` (U2) edited directly in the vault (no commit applicable there) and contains no remaining `Media/YouTube/` "active" or `Reference/YouTube/` "legacy" language.
- U4 executed only after the user approved the migration manifest; the resulting migration log accounts for all 58 source files.
- `Media/YouTube/` is empty; `Reference/YouTube/` and every touched `Reference/<Topic>/` subfolder contain only canonically-named files; no file content was lost (verified by the apply-mode hash check in U3).
- The MCP server has been reconnected/restarted at least once against the rebuilt code before being relied on for new notes.

---

## Sources & Research

- `youtube-tools.ts`, `skill-extractor.ts`, `youtube-downloader.ts`, `file-manager.ts` — current server implementation.
- `tests/skill-extraction.test.ts` — current extraction test fixture (still modeled on the pre-v3.2.0 `SKILL.md` shape).
- `docs/plans/2026-09-07-001-feat-youtube-summary-note-tool-plan.md` — original plan that targeted `Reference/` before the pivot.
- `.kilo/plans/1788792894235-summary-note-auto-fixes.md` and commits `1c72868`, `7170f3c` — the 2026-09-07 pivot to `Media/YouTube/`, and why it happened at the time.
- `~/.claude/skills/obsidian-note-creator/SKILL.md` (v3.2.0) — confirms the "Common Folder Locations" table no longer exists; folder data now lives per-vault.
- `/home/jandal/Documents/Obsidian/METJM/_vault-structure.md` — confirms the current (contradictory) convention being corrected by U2.
- Live directory listings of `Media/YouTube/` (55 files, 17 undated, 1 stray `.txt`, several duplicate-titled clusters) and `Reference/YouTube/`, `Reference/Technology/`, `Reference/UI/`, `Reference/Finance/`, etc.
- Confirmed `/home/jandal/Documents/Obsidian/METJM/` is not a git repository — informs KTD4's copy-verify-delete approach.
- `tsconfig.json` (confirmed `include: ["*.ts"]`, non-recursive) — informs U3's tsconfig-widening step.
- `/home/jandal/Projects/MCP/omatube-captions/scripts/process-youtube-url.sh` and `scripts/claude-prompt-template.txt` (confirmed present on this machine) — informs the Open Questions on external-caller scope.
- Compared `created:` frontmatter against filesystem mtime for the undated `Media/YouTube/` files — confirmed material divergence (e.g. `created: 2025-03-25` vs. an mtime over a year later) — informs KTD6's refinement.
