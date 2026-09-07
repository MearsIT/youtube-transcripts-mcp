---
title: "feat: Add self-contained YouTube summary note creation"
created: 2026-09-07-16:00
type: feat
status: draft
---

# feat: Add self-contained YouTube summary note creation

## Summary

Add a `create-youtube-summary-note` MCP tool that encapsulates the full YouTube → Obsidian workflow, making the MCP server portable and self-contained. The tool coordinates transcript download with Claude by bundling formatting instructions from the obsidian-note-creator skill (or a fallback copy), enabling anyone to install the MCP server and get working YouTube notes without external skills or custom prompts.

---

## Problem Frame

**Current state**: The MCP server only handles raw transcript download/cleaning. Note creation logic lives in external prompts and skills, making the workflow:
- **Not portable** - breaks for new users without obsidian-note-creator skill installed
- **Brittle** - button project and Claude Desktop use different workflows
- **Hard to maintain** - formatting logic duplicated across projects

**Goal**: Make the MCP server the single source of truth for YouTube → Obsidian notes. The server should work standalone - no external skills or prompts required.

**Approach**: The MCP tool bundles transcript data with formatting instructions extracted from obsidian-note-creator skill (with embedded fallback), returning both to Claude. Claude follows the bundled instructions to format and save the note.

---

## Requirements

**R1. Self-contained operation**: Tool works without external skills installed  
**R2. Automatic skill discovery**: Use user's obsidian-note-creator skill when present  
**R3. Fallback reliability**: Embedded instructions ensure tool always works  
**R4. Format consistency**: Notes match obsidian-note-creator reference template  
**R5. Correct note location**: Save to `Reference/` folder, not `Transcripts/yt/`  

---

## Key Technical Decisions

### KTD1. Skill Discovery with Fallback Hierarchy

**Decision**: Check `~/.claude/skills/obsidian-note-creator/SKILL.md`, fall back to embedded instructions.

**Rationale**:
- **Automatic updates** - When skill exists, changes flow through automatically
- **Portability** - Embedded fallback ensures tool works for everyone
- **Simplicity** - No configuration required; works out of the box

**Trade-off**: Embedded copy can drift from skill updates, but this is acceptable since:
- Most users will have the skill installed (primary path)
- Fallback is a safety net, not the primary mechanism
- Drift would only affect new users without the skill

**Implementation**: Use `fs.access()` to test file existence before reading, catch errors gracefully.

### KTD2. Instruction Bundling Format

**Decision**: Return markdown-formatted instructions in MCP tool response alongside transcript.

**Rationale**:
- **MCP compatibility** - Tools return text content; Claude receives everything in one response
- **No protocol changes** - Leverages existing MCP content array structure
- **Clear separation** - Instructions + data bundled cleanly in markdown sections

**Format**:
```markdown
**YouTube Caption Processing Complete**

[transcript statistics]

**Instructions for Claude:**
Format this transcript as an Obsidian reference note following these rules:

[extracted/fallback formatting rules]

**Full Cleaned Text:**
[transcript content]
```

### KTD3. Extraction Strategy from Skill File

**Decision**: Extract specific sections (frontmatter structure, field rules, reference template, folder location) via pattern matching, not full skill parsing.

**Rationale**:
- **Stable sections** - The core reference note format rarely changes
- **Simpler** - Regex/line-based extraction vs. full markdown parser
- **Sufficient** - Only need reference note format, not all note types

**Extraction targets** (from obsidian-note-creator SKILL.md):
- YAML frontmatter template (lines ~34-46)
- Field rules (lines ~48-64) 
- Reference template structure (lines ~193-213)
- Folder location: `Reference/` (line ~670)
- Filename convention: no date prefix for reference notes (line ~74)

**Fallback**: If extraction fails or file missing, use complete embedded template.

---

## Implementation Units

### U1. Create Skill Extraction Utility

**Goal**: Read and extract reference note formatting instructions from obsidian-note-creator skill file.

**Dependencies**: None

**Files**:
- `skill-extractor.ts` (new) - Extraction logic and fallback

**Approach**:
- Export `async function extractSkillInstructions(): Promise<string>`
- Check `~/.claude/skills/obsidian-note-creator/SKILL.md` with `fs.access()`
- If exists: read file, extract frontmatter + reference template + rules
- If missing or extraction fails: return embedded fallback
- Log which path was used (discovered vs fallback) to stderr

**Patterns to follow**:
- File I/O pattern from file-manager.ts (fs.promises, UTF-8 encoding)
- Logger pattern from index.ts (stderr only, structured timestamps)
- Error handling pattern (try-catch, never throw, return fallback on error)

**Test scenarios**:
- **Happy path**: Skill file exists at standard location → returns extracted instructions
- **Fallback path**: Skill file missing → returns embedded fallback instructions
- **Malformed skill**: Skill file exists but extraction fails (corrupted, wrong format) → returns embedded fallback
- **Permission denied**: Skill file exists but unreadable → returns embedded fallback and logs warning

**Verification**: Unit test with mocked fs.access and fs.readFile returns correct instructions for each scenario. Embedded fallback is valid markdown matching current obsidian-note-creator reference format.

---

### U2. Create Bundled Fallback Instructions

**Goal**: Embed reference note formatting instructions as a constant for fallback when skill file is unavailable.

**Dependencies**: None (can develop in parallel with U1)

**Files**:
- `skill-extractor.ts` - Add FALLBACK_REFERENCE_INSTRUCTIONS constant

**Approach**:
- Define `const FALLBACK_REFERENCE_INSTRUCTIONS` as multiline template literal
- Based on current obsidian-note-creator SKILL.md (version 3.1.0)
- Include: YAML frontmatter structure, field rules, reference template, filename convention, target folder
- Format as clear markdown instructions Claude can parse

**Technical design**:
```typescript
const FALLBACK_REFERENCE_INSTRUCTIONS = `
Format this YouTube transcript as an Obsidian reference note:

**YAML Frontmatter** (required):
---
title: [Descriptive Title - Speaker/Topic]
created: [YYYY-MM-DD-HH:MM]
modified: [YYYY-MM-DD-HH:MM]  
tags: [youtube, transcript, topic-tags]
type: reference
status: complete
project: 
---

**Note Structure**:
# [Title]

## Overview/Summary
[What the video covers and key points]

## Key Concepts  
[Main ideas and definitions]

## Details/Content
[Detailed information from transcript]

## Notes
[Additional observations]

## Related Notes
- [[Related topic links]]

**File Naming**: Descriptive Title Case name.md (NO date prefix)
**Target Folder**: Reference/
`;
```

**Patterns to follow**:
- Match exact format from obsidian-note-creator SKILL.md reference template
- Use template literal for readability
- Include all required fields from current skill version

**Test scenarios**:
- Test expectation: none - this is a static constant, verified by code review

**Verification**: Constant text matches current obsidian-note-creator reference format. Instructions are clear enough for Claude to follow without ambiguity.

---

### U3. Register create-youtube-summary-note Tool

**Goal**: Add new MCP tool that coordinates transcript download with skill instruction bundling.

**Dependencies**: U1 (skill extractor), U2 (fallback instructions)

**Files**:
- `youtube-tools.ts` - Add new tool registration
- `skill-extractor.ts` - Import extraction function
- `index.ts` - Update tool count in logger (line ~106: `toolCount: 4` → `toolCount: 5`)

**Approach**:
- Register tool with schema: `url` (required string), `outputDir` (optional string, defaults to `/home/jandal/Documents/Obsidian/METJM/Reference`)
- Tool handler workflow:
  1. Call existing `downloadYouTubeCaptions()` to get VTT
  2. Call existing `cleanVttFile()` and `joinCaptions()` to get cleaned text
  3. Call `extractSkillInstructions()` to get formatting rules
  4. Bundle: transcript stats + instructions + transcript text
  5. Return bundled response to Claude
- Response format: Markdown with clear sections (see KTD2 format above)
- Log operation with requestId for tracing

**Technical design** (directional, not implementation code):
```typescript
server.registerTool(
  "create-youtube-summary-note",
  {
    title: "Create YouTube Summary Note",
    description: "Download YouTube captions and bundle with formatting instructions for Obsidian reference note creation",
    inputSchema: {
      url: z.string().describe("YouTube video URL"),
      outputDir: z.string().optional().describe("Note output directory (default: Reference/)")
    } as any
  },
  async (args: any) => {
    const { url, outputDir = "/home/jandal/Documents/Obsidian/METJM/Reference" } = args;
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // 1. Download + clean transcript (reuse existing logic)
    // 2. Extract skill instructions
    // 3. Bundle and return
    
    return {
      content: [{
        type: "text",
        text: `**YouTube Caption Processing Complete**
        
[stats]

**Instructions for Claude:**
${skillInstructions}

**Target Directory:** ${outputDir}

**Full Cleaned Text:**
${captionText}`
      }]
    };
  }
);
```

**Patterns to follow**:
- Tool registration pattern from existing tools (process-youtube-captions, save-formatted-transcript)
- Reuse `downloadYouTubeCaptions()`, `cleanVttFile()`, `joinCaptions()` from existing modules
- Logger pattern (stderr only, structured context)
- Error handling pattern (try-catch with isError flag)

**Test scenarios**:
- **Happy path**: Valid YouTube URL + skill file exists → returns bundled transcript + extracted instructions + target directory
- **Fallback path**: Valid YouTube URL + no skill file → returns bundled transcript + embedded fallback instructions
- **Invalid URL**: Malformed URL → returns error with `isError: true`
- **No captions**: Video without captions → returns error explaining no captions available
- **Custom outputDir**: URL + custom directory path → returns bundled response with specified directory
- **Integration**: Full flow with Claude following bundled instructions produces properly formatted note in Reference/ folder

**Verification**: 
- Tool appears in MCP server tool list (`health-check` response updates)
- Manual test with real YouTube URL returns bundled response
- Response format is valid markdown Claude can parse
- Logged operation appears in stderr with requestId

---

### U4. Add Integration Test

**Goal**: Verify end-to-end tool functionality with both discovered and fallback skill paths.

**Dependencies**: U3 (tool registration complete)

**Files**:
- `test-summary-note.js` (new) - Manual integration test script
- `tests/skill-extraction.test.ts` (new) - Unit tests for extraction logic

**Approach**:

**Unit tests** (`skill-extraction.test.ts`):
- Test skill file discovery (mock fs.access returns true)
- Test fallback when file missing (mock fs.access returns false)  
- Test extraction parsing (mock fs.readFile returns sample skill content)
- Test malformed skill handling (extraction fails → fallback)

**Integration test** (`test-summary-note.js`):
- Spawn MCP server process
- Send JSON-RPC request to `create-youtube-summary-note` with test video URL
- Verify response structure (bundled instructions present, transcript present)
- Test both paths: rename skill file temporarily to test fallback, restore to test discovery
- Manual: Have Claude consume response and verify note creation

**Patterns to follow**:
- Test structure from existing `test-simple.js` (JSON-RPC over stdio)
- Unit test pattern from `youtube-url.test.ts` (Vitest framework)
- Stderr monitoring to verify logging works

**Test scenarios**:
- **Unit - skill discovered**: Mocked file exists → extraction called, instructions returned
- **Unit - fallback used**: Mocked file missing → fallback returned without fs.readFile call
- **Unit - extraction failure**: Mocked read succeeds but parse fails → fallback returned
- **Integration - full flow with skill**: Real MCP server + real skill file → bundled response valid
- **Integration - full flow without skill**: Real MCP server + skill file hidden → fallback response valid
- **Integration - Claude consumption**: Manual verification - Claude follows bundled instructions and creates properly formatted note in Reference/

**Verification**:
- All unit tests pass (`npm test`)
- Integration test creates bundled response matching expected format
- Stderr logs show correct path taken (discovered vs fallback)
- Manual test: Claude creates properly formatted reference note in Reference/ folder with correct frontmatter and structure

---

## Scope Boundaries

**In scope**:
- New `create-youtube-summary-note` MCP tool
- Skill file discovery and extraction
- Embedded fallback instructions
- Integration test for verification

**Deferred to follow-up work**:
- Updating button project to use new tool (separate PR in omatube-captions repo)
- Configuration file for custom skill paths or output directories
- Support for other note types beyond reference notes
- Automatic skill sync mechanism (detecting skill file changes)

**Out of scope**:
- Changing existing MCP tools (process-youtube-captions, save-formatted-transcript remain unchanged)
- Cross-platform skill discovery (Windows/macOS paths) - Linux only for now
- MCP server configuration system - using hardcoded defaults is acceptable

---

## Open Questions

None - all planning-time questions resolved. Deferred to implementation:
- Exact error message wording
- Whether to include video metadata (publish date, channel) in bundled response - decide based on what Claude needs
- Skill file version detection - may add later if skill format changes significantly

---

## Risks & Dependencies

**Risk**: Embedded fallback instructions drift from obsidian-note-creator skill updates.

**Mitigation**: 
- Primary path uses discovered skill when available (most users)
- Document fallback update process in code comments
- Consider adding skill version check in future iteration

**Dependency**: Requires obsidian-note-creator skill to exist for testing extraction path.

**Mitigation**: Test both paths (discovered + fallback) during integration testing. Fallback path must work standalone.

---

## System-Wide Impact

**MCP Server**:
- New tool increases server capabilities
- No breaking changes to existing tools
- Tool count increments from 4 to 5

**Button Project** (omatube-captions repo):
- Can simplify to single MCP tool call (follow-up work)
- Existing workflow continues to work during transition

**Obsidian Vault**:
- Notes will now go to `Reference/` instead of `Transcripts/yt/`
- Existing notes unaffected
- New naming convention: Title Case, no date prefix

---

## Sources & Research

**Codebase patterns**:
- Existing MCP tool registration (youtube-tools.ts)
- File I/O utilities (file-manager.ts)
- Error handling and logging (index.ts)

**Obsidian-note-creator skill**:
- Version 3.1.0 at `/home/jandal/.claude/skills/obsidian-note-creator/SKILL.md`
- Reference template (lines 189-213)
- Folder locations (line 661-680)
- Frontmatter rules (lines 30-64)

**User conversation context**:
- Button project requirements (self-contained, portable)
- Fallback hierarchy approach (discovery → embedded)
- Reference folder target (user's explicit choice)
