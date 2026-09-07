import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const logger = {
    info: (msg, context) => console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
    warn: (msg, context) => console.error(`[WARN] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : '')
};
/**
 * Embedded fallback instructions, based on obsidian-note-creator SKILL.md v3.1.0
 * (reference note template). Used when the skill file is missing or unreadable.
 * Update this constant when the skill's reference format changes.
 */
export const FALLBACK_REFERENCE_INSTRUCTIONS = `Format this YouTube transcript as an Obsidian reference note.

**YAML Frontmatter** (required, exactly this structure):
---
title: [Descriptive Title - Speaker/Topic]
created: [YYYY-MM-DD-HH:MM]
modified: [YYYY-MM-DD-HH:MM]
tags: [youtube, transcript, topic-tags]
type: reference
status: complete
project:
---

**Frontmatter Field Rules**:
- title: the main heading of the note (string)
- created / modified: ISO datetime format \`YYYY-MM-DD-HH:MM\` (hyphen before time), both set to current timestamp on creation
- tags: array format only (e.g. \`[youtube, transcript]\`); tags ONLY in frontmatter, never inline \`#tag\` in the body
- type: must be \`reference\`
- status: one of \`draft\`, \`in-progress\`, \`complete\`, \`archived\`
- project: wiki-link format \`[[Project Name]]\` if applicable, or empty

**Note Structure**:
# [Reference Title]

## Overview/Summary
What this covers and why it is useful.

## Key Concepts
Main ideas and definitions.

## Details/Content
Detailed reference information.

## Examples
Practical examples if applicable.

## Notes
Additional context or caveats.

## Related Notes
- [[Related references]]

**File Naming**: kebab-case descriptive name (lowercase with hyphens), NO date prefix — e.g. \`descriptive-name.md\`
**Target Folder**: Reference/`;
/**
 * Default skill file location
 */
export function getDefaultSkillPath() {
    return join(homedir(), '.claude', 'skills', 'obsidian-note-creator', 'SKILL.md');
}
/**
 * Extract reference note formatting instructions from obsidian-note-creator
 * SKILL.md content. Returns null if any required section cannot be found.
 */
export function extractInstructionsFromSkill(skillContent) {
    const sections = [];
    // 1. YAML frontmatter template (```yaml block after "### YAML Frontmatter Structure")
    const frontmatterBlock = matchCodeBlock(skillContent, /### YAML Frontmatter Structure\s*\n[\s\S]*?```yaml\n([\s\S]*?)```/);
    if (!frontmatterBlock)
        return null;
    sections.push(`**YAML Frontmatter** (required, exactly this structure):\n${frontmatterBlock.trim()}`);
    // 2. Field rules (section body between "### Frontmatter Field Rules" and next "---")
    const fieldRules = matchSectionBody(skillContent, /### Frontmatter Field Rules\s*\n([\s\S]*?)(?=\n---\s*\n)/);
    if (!fieldRules)
        return null;
    sections.push(`**Frontmatter Field Rules**:\n${fieldRules.trim()}`);
    // 3. Reference note template (```markdown block inside "### `reference`" section)
    const referenceBlock = matchCodeBlock(skillContent, /### `reference`\s*\n[\s\S]*?```markdown\n([\s\S]*?)```/);
    if (!referenceBlock)
        return null;
    sections.push(`**Note Structure** (reference note template):\n${referenceBlock.trim()}`);
    // 4. Reference filename convention (line from File Naming Conventions)
    const namingLine = skillContent.match(/^- (Reference\/permanent notes:.*)$/m);
    if (!namingLine)
        return null;
    sections.push(`**File Naming**: ${namingLine[1]}`);
    // 5. Reference folder location (row from Common Folder Locations table)
    const folderRow = skillContent.match(/^\| `reference` \| (`[^`]+`)/m);
    if (!folderRow)
        return null;
    sections.push(`**Target Folder**: ${folderRow[1].replace(/`/g, '')}`);
    return `Format this YouTube transcript as an Obsidian reference note.\n\n${sections.join('\n\n')}`;
}
function matchCodeBlock(content, regex) {
    const match = content.match(regex);
    return match ? match[1] : null;
}
function matchSectionBody(content, regex) {
    const match = content.match(regex);
    return match ? match[1] : null;
}
/**
 * Get reference note formatting instructions: extracted from the user's
 * obsidian-note-creator skill when available, otherwise the embedded fallback.
 * Never throws.
 */
export async function extractSkillInstructions(skillPath) {
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
        return FALLBACK_REFERENCE_INSTRUCTIONS;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Skill file unavailable, using embedded fallback instructions', {
            source: resolvedPath,
            error: errorMessage
        });
        return FALLBACK_REFERENCE_INSTRUCTIONS;
    }
}
//# sourceMappingURL=skill-extractor.js.map