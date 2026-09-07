import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractSkillInstructions,
  extractInstructionsFromSkill,
  FALLBACK_NOTE_INSTRUCTIONS,
  getDefaultSkillPath
} from '../skill-extractor.js';

const SAMPLE_SKILL_CONTENT = `---
name: obsidian-note-creator
metadata:
  version: 3.1.0
---

# Obsidian Note Creator

## Core Formatting Standards

### YAML Frontmatter Structure

Every note MUST include this exact frontmatter:

\`\`\`yaml
---
title: [Note Title]
created: [YYYY-MM-DD-HH:MM]
modified: [YYYY-MM-DD-HH:MM]
tags: []
type: [note-type]
status: [draft|in-progress|complete|archived]
project: [Project Name or empty]
---
\`\`\`

### Frontmatter Field Rules

**title**: The main heading of the note (string)

**created / modified**: ISO datetime format \`YYYY-MM-DD-HH:MM\`.

**tags**: Array format only.

---

## File Naming Conventions

- Use **kebab-case** for file names (lowercase with hyphens)
- Reference/permanent notes: \`descriptive-name.md\` (no date prefix)

---

## Valid Note Types & Templates

### \`reference\`

Used for reference material, guides, and general knowledge.

\`\`\`markdown
# [Reference Title]

## Overview/Summary
What this covers and why it is useful.

## Key Concepts
Main ideas and definitions.

## Related Notes
- [[Related references]]
\`\`\`

### \`youtube-transcript\`

Used for processed YouTube video transcripts and summaries.

\`\`\`markdown
# [Video Title]

## Overview/Summary
Brief summary of the video content and main takeaways.

## Video Details
- **Channel**: [Channel Name]
- **URL**: [YouTube URL]
- **Duration**: [Duration]
- **Published**: [Date]

## Key Topics
- Topic 1
- Topic 2

## Main Content
Structured summary or processed transcript content.

## Key Quotes
> Notable quotes from the video

## Insights/Notes
Personal observations and connections.

## Related Notes
- [[Related topic]]
\`\`\`

---

## Common Folder Locations

| Note type | Folder |
|---|---|
| \`reference\` | \`Reference/\` |
| \`youtube-transcript\` | \`Media/YouTube/\` |
`;

const MALFORMED_SKILL_CONTENT = `---
name: some-other-skill
---

# Unrelated Skill

This file has no youtube-transcript note sections at all.
`;

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(join(tmpdir(), 'skill-extraction-test-'));
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('getDefaultSkillPath', () => {
  it('points at the obsidian-note-creator SKILL.md under the home directory', () => {
    expect(getDefaultSkillPath()).toMatch(/\.claude\/skills\/obsidian-note-creator\/SKILL\.md$/);
  });
});

describe('extractInstructionsFromSkill', () => {
  it('extracts frontmatter template, field rules, youtube-transcript template, naming, and folder from valid skill content', () => {
    const result = extractInstructionsFromSkill(SAMPLE_SKILL_CONTENT);

    expect(result).not.toBeNull();
    expect(result).toContain('title: [Note Title]');
    expect(result).toContain('**Frontmatter Field Rules**');
    expect(result).toContain('## Video Details');
    expect(result).toContain('## Key Topics');
    expect(result).toContain('## Main Content');
    expect(result).toContain('## Key Quotes');
    expect(result).toContain('## Insights/Notes');
    expect(result).toContain('**Target Folder**: Media/YouTube/');
  });

  it('prepends the no-questions automation header', () => {
    const result = extractInstructionsFromSkill(SAMPLE_SKILL_CONTENT);

    expect(result).toMatch(/^Create the note immediately\. Do NOT ask the user any questions/);
    expect(result).toContain('Do NOT use any other skill or template');
  });

  it('injects the date-prefix naming rule instead of the skill naming line', () => {
    const result = extractInstructionsFromSkill(SAMPLE_SKILL_CONTENT);

    expect(result).toContain('YYYY-MM-DD_HHMM-kebab-case-title.md');
    expect(result).not.toContain('no date prefix');
  });

  it('returns null for content without youtube-transcript note sections', () => {
    expect(extractInstructionsFromSkill(MALFORMED_SKILL_CONTENT)).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(extractInstructionsFromSkill('')).toBeNull();
  });
});

describe('extractSkillInstructions', () => {
  it('returns extracted instructions when skill file exists and parses', async () => {
    const skillPath = join(tempDir, 'SKILL.md');
    await fs.writeFile(skillPath, SAMPLE_SKILL_CONTENT, 'utf-8');

    const result = await extractSkillInstructions(skillPath);

    expect(result).toContain('title: [Note Title]');
    expect(result).toContain('**Target Folder**: Media/YouTube/');
    expect(result).not.toBe(FALLBACK_NOTE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file is missing', async () => {
    const result = await extractSkillInstructions(join(tempDir, 'does-not-exist.md'));

    expect(result).toBe(FALLBACK_NOTE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file exists but extraction fails', async () => {
    const skillPath = join(tempDir, 'Malformed.md');
    await fs.writeFile(skillPath, MALFORMED_SKILL_CONTENT, 'utf-8');

    const result = await extractSkillInstructions(skillPath);

    expect(result).toBe(FALLBACK_NOTE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file is unreadable (permission denied)', async () => {
    const skillPath = join(tempDir, 'NoRead.md');
    await fs.writeFile(skillPath, SAMPLE_SKILL_CONTENT, 'utf-8');
    await fs.chmod(skillPath, 0o000);

    const result = await extractSkillInstructions(skillPath);

    expect(result).toBe(FALLBACK_NOTE_INSTRUCTIONS);

    await fs.chmod(skillPath, 0o644);
  });
});

describe('FALLBACK_NOTE_INSTRUCTIONS', () => {
  it('contains the required youtube-transcript note structure elements', () => {
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('type: youtube-transcript');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('## Overview/Summary');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('## Video Details');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('## Main Content');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('## Key Quotes');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('## Related Notes');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('Media/YouTube/');
  });

  it('contains the date-prefix naming rule and no-questions directive', () => {
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('YYYY-MM-DD_HHMM-kebab-case-title.md');
    expect(FALLBACK_NOTE_INSTRUCTIONS).toMatch(/^Create the note immediately\. Do NOT ask the user any questions/);
    expect(FALLBACK_NOTE_INSTRUCTIONS).toContain('Do NOT use any other skill or template');
  });
});
