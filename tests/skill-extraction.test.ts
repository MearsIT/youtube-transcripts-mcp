import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractSkillInstructions,
  extractInstructionsFromSkill,
  FALLBACK_REFERENCE_INSTRUCTIONS,
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

---

## Common Folder Locations

| Note type | Folder |
|---|---|
| \`reference\` | \`Reference/\` |
`;

const MALFORMED_SKILL_CONTENT = `---
name: some-other-skill
---

# Unrelated Skill

This file has no reference note sections at all.
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
  it('extracts frontmatter template, field rules, reference template, naming, and folder from valid skill content', () => {
    const result = extractInstructionsFromSkill(SAMPLE_SKILL_CONTENT);

    expect(result).not.toBeNull();
    expect(result).toContain('title: [Note Title]');
    expect(result).toContain('**Frontmatter Field Rules**');
    expect(result).toContain('## Overview/Summary');
    expect(result).toContain('descriptive-name.md');
    expect(result).toContain('**Target Folder**: Reference/');
  });

  it('returns null for content without reference note sections', () => {
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
    expect(result).toContain('**Target Folder**: Reference/');
    expect(result).not.toBe(FALLBACK_REFERENCE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file is missing', async () => {
    const result = await extractSkillInstructions(join(tempDir, 'does-not-exist.md'));

    expect(result).toBe(FALLBACK_REFERENCE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file exists but extraction fails', async () => {
    const skillPath = join(tempDir, 'Malformed.md');
    await fs.writeFile(skillPath, MALFORMED_SKILL_CONTENT, 'utf-8');

    const result = await extractSkillInstructions(skillPath);

    expect(result).toBe(FALLBACK_REFERENCE_INSTRUCTIONS);
  });

  it('returns embedded fallback when skill file is unreadable (permission denied)', async () => {
    const skillPath = join(tempDir, 'NoRead.md');
    await fs.writeFile(skillPath, SAMPLE_SKILL_CONTENT, 'utf-8');
    await fs.chmod(skillPath, 0o000);

    const result = await extractSkillInstructions(skillPath);

    expect(result).toBe(FALLBACK_REFERENCE_INSTRUCTIONS);

    await fs.chmod(skillPath, 0o644);
  });
});

describe('FALLBACK_REFERENCE_INSTRUCTIONS', () => {
  it('contains the required reference note structure elements', () => {
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('type: reference');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('## Overview/Summary');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('## Key Concepts');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('## Related Notes');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('kebab-case');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('NO date prefix');
    expect(FALLBACK_REFERENCE_INSTRUCTIONS).toContain('Reference/');
  });
});
