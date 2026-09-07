import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const logger = {
  info: (msg: string, context?: any) =>
    console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
  warn: (msg: string, context?: any) =>
    console.error(`[WARN] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : '')
};

/**
 * Directive prepended to all instruction bundles: the note must be created
 * fully automatically, with no questions, confirmation, or other skills.
 */
const AUTOMATION_HEADER = `Create the note immediately. Do NOT ask the user any questions or seek confirmation. Do NOT use any other skill or template. Use the target directory and suggested filename provided in the tool response.`;

/**
 * Naming rule injected in place of the skill's own (no-date-prefix) rule.
 */
const NAMING_RULE = `**File Naming**: \`YYYY-MM-DD_HHMM-kebab-case-title.md\` (local time, lowercase-hyphenated title, date+time prefix required) — e.g. \`2026-09-02_1639_jacob-collier-cult-of-genius.md\``;

/**
 * Embedded fallback instructions, based on obsidian-note-creator SKILL.md v3.1.0
 * (youtube-transcript note template). Used when the skill file is missing or unreadable.
 * Update this constant when the skill's youtube-transcript format changes.
 */
export const FALLBACK_NOTE_INSTRUCTIONS = `${AUTOMATION_HEADER}

Format this YouTube transcript as an Obsidian youtube-transcript note.

**YAML Frontmatter** (required, exactly this structure):
---
title: [Video Title]
created: [YYYY-MM-DD-HH:MM]
modified: [YYYY-MM-DD-HH:MM]
tags: [youtube, transcript, topic-tags]
type: youtube-transcript
status: complete
project:
---

**Frontmatter Field Rules**:
- title: the main heading of the note (string)
- created / modified: ISO datetime format \`YYYY-MM-DD-HH:MM\` (hyphen before time), both set to current timestamp on creation
- tags: array format only (e.g. \`[youtube, transcript]\`); tags ONLY in frontmatter, never inline \`#tag\` in the body
- type: must be \`youtube-transcript\`
- status: one of \`draft\`, \`in-progress\`, \`complete\`, \`archived\`
- project: wiki-link format \`[[Project Name]]\` if applicable, or empty

**Note Structure** (youtube-transcript note template):
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
- [[Similar content]]

${NAMING_RULE}
**Target Folder**: Media/YouTube/`;

/**
 * Default skill file location
 */
export function getDefaultSkillPath(): string {
  return join(homedir(), '.claude', 'skills', 'obsidian-note-creator', 'SKILL.md');
}

/**
 * Extract youtube-transcript note formatting instructions from obsidian-note-creator
 * SKILL.md content. Returns null if any required section cannot be found.
 */
export function extractInstructionsFromSkill(skillContent: string): string | null {
  const sections: string[] = [];

  // 1. YAML frontmatter template (```yaml block after "### YAML Frontmatter Structure")
  const frontmatterBlock = matchCodeBlock(skillContent, /### YAML Frontmatter Structure\s*\n[\s\S]*?```yaml\n([\s\S]*?)```/);
  if (!frontmatterBlock) return null;
  sections.push(`**YAML Frontmatter** (required, exactly this structure):\n${frontmatterBlock.trim()}`);

  // 2. Field rules (section body between "### Frontmatter Field Rules" and next "---")
  const fieldRules = matchSectionBody(skillContent, /### Frontmatter Field Rules\s*\n([\s\S]*?)(?=\n---\s*\n)/);
  if (!fieldRules) return null;
  sections.push(`**Frontmatter Field Rules**:\n${fieldRules.trim()}`);

  // 3. youtube-transcript note template (```markdown block inside "### `youtube-transcript`" section)
  const templateBlock = matchCodeBlock(skillContent, /### `youtube-transcript`\s*\n[\s\S]*?```markdown\n([\s\S]*?)```/);
  if (!templateBlock) return null;
  sections.push(`**Note Structure** (youtube-transcript note template):\n${templateBlock.trim()}`);

  // 4. Naming rule: injected (the skill's own rule forbids date prefixes, which we require)
  sections.push(NAMING_RULE);

  // 5. youtube-transcript folder location (row from Common Folder Locations table)
  const folderRow = skillContent.match(/^\| `youtube-transcript` \| (`[^`]+`)/m);
  if (!folderRow) return null;
  sections.push(`**Target Folder**: ${folderRow[1].replace(/`/g, '')}`);

  return `${AUTOMATION_HEADER}\n\nFormat this YouTube transcript as an Obsidian youtube-transcript note.\n\n${sections.join('\n\n')}`;
}

function matchCodeBlock(content: string, regex: RegExp): string | null {
  const match = content.match(regex);
  return match ? match[1] : null;
}

function matchSectionBody(content: string, regex: RegExp): string | null {
  const match = content.match(regex);
  return match ? match[1] : null;
}

/**
 * Get youtube-transcript note formatting instructions: extracted from the user's
 * obsidian-note-creator skill when available, otherwise the embedded fallback.
 * Never throws.
 */
export async function extractSkillInstructions(skillPath?: string): Promise<string> {
  const resolvedPath = skillPath || getDefaultSkillPath();

  try {
    await fs.access(resolvedPath);

    const content = await fs.readFile(resolvedPath, 'utf-8');
    const extracted = extractInstructionsFromSkill(content);

    if (extracted) {
      logger.info('Skill instructions discovered', { source: resolvedPath });
      return extracted;
    }

    logger.warn('Skill file present but extraction failed, using fallback', { source: resolvedPath });
    return FALLBACK_NOTE_INSTRUCTIONS;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Skill file unavailable, using embedded fallback instructions', {
      source: resolvedPath,
      error: errorMessage
    });
    return FALLBACK_NOTE_INSTRUCTIONS;
  }
}
