/**
 * Embedded fallback instructions, based on obsidian-note-creator SKILL.md v3.1.0
 * (reference note template). Used when the skill file is missing or unreadable.
 * Update this constant when the skill's reference format changes.
 */
export declare const FALLBACK_REFERENCE_INSTRUCTIONS = "Format this YouTube transcript as an Obsidian reference note.\n\n**YAML Frontmatter** (required, exactly this structure):\n---\ntitle: [Descriptive Title - Speaker/Topic]\ncreated: [YYYY-MM-DD-HH:MM]\nmodified: [YYYY-MM-DD-HH:MM]\ntags: [youtube, transcript, topic-tags]\ntype: reference\nstatus: complete\nproject:\n---\n\n**Frontmatter Field Rules**:\n- title: the main heading of the note (string)\n- created / modified: ISO datetime format `YYYY-MM-DD-HH:MM` (hyphen before time), both set to current timestamp on creation\n- tags: array format only (e.g. `[youtube, transcript]`); tags ONLY in frontmatter, never inline `#tag` in the body\n- type: must be `reference`\n- status: one of `draft`, `in-progress`, `complete`, `archived`\n- project: wiki-link format `[[Project Name]]` if applicable, or empty\n\n**Note Structure**:\n# [Reference Title]\n\n## Overview/Summary\nWhat this covers and why it is useful.\n\n## Key Concepts\nMain ideas and definitions.\n\n## Details/Content\nDetailed reference information.\n\n## Examples\nPractical examples if applicable.\n\n## Notes\nAdditional context or caveats.\n\n## Related Notes\n- [[Related references]]\n\n**File Naming**: kebab-case descriptive name (lowercase with hyphens), NO date prefix \u2014 e.g. `descriptive-name.md`\n**Target Folder**: Reference/";
/**
 * Default skill file location
 */
export declare function getDefaultSkillPath(): string;
/**
 * Extract reference note formatting instructions from obsidian-note-creator
 * SKILL.md content. Returns null if any required section cannot be found.
 */
export declare function extractInstructionsFromSkill(skillContent: string): string | null;
/**
 * Get reference note formatting instructions: extracted from the user's
 * obsidian-note-creator skill when available, otherwise the embedded fallback.
 * Never throws.
 */
export declare function extractSkillInstructions(skillPath?: string): Promise<string>;
//# sourceMappingURL=skill-extractor.d.ts.map