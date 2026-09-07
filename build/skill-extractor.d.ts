/**
 * Embedded fallback instructions, based on obsidian-note-creator SKILL.md v3.1.0
 * (youtube-transcript note template). Used when the skill file is missing or unreadable.
 * Update this constant when the skill's youtube-transcript format changes.
 */
export declare const FALLBACK_NOTE_INSTRUCTIONS = "Create the note immediately. Do NOT ask the user any questions or seek confirmation. Do NOT use any other skill or template. Use the target directory and suggested filename provided in the tool response.\n\nFormat this YouTube transcript as an Obsidian youtube-transcript note.\n\n**YAML Frontmatter** (required, exactly this structure):\n---\ntitle: [Video Title]\ncreated: [YYYY-MM-DD-HH:MM]\nmodified: [YYYY-MM-DD-HH:MM]\ntags: [youtube, transcript, topic-tags]\ntype: youtube-transcript\nstatus: complete\nproject:\n---\n\n**Frontmatter Field Rules**:\n- title: the main heading of the note (string)\n- created / modified: ISO datetime format `YYYY-MM-DD-HH:MM` (hyphen before time), both set to current timestamp on creation\n- tags: array format only (e.g. `[youtube, transcript]`); tags ONLY in frontmatter, never inline `#tag` in the body\n- type: must be `youtube-transcript`\n- status: one of `draft`, `in-progress`, `complete`, `archived`\n- project: wiki-link format `[[Project Name]]` if applicable, or empty\n\n**Note Structure** (youtube-transcript note template):\n# [Video Title]\n\n## Overview/Summary\nBrief summary of the video content and main takeaways.\n\n## Video Details\n- **Channel**: [Channel Name]\n- **URL**: [YouTube URL]\n- **Duration**: [Duration]\n- **Published**: [Date]\n\n## Key Topics\n- Topic 1\n- Topic 2\n\n## Main Content\nStructured summary or processed transcript content.\n\n## Key Quotes\n> Notable quotes from the video\n\n## Insights/Notes\nPersonal observations and connections.\n\n## Related Notes\n- [[Related topic]]\n- [[Similar content]]\n\n**File Naming**: `YYYY-MM-DD_HHMM-kebab-case-title.md` (local time, lowercase-hyphenated title, date+time prefix required) \u2014 e.g. `2026-09-02_1639_jacob-collier-cult-of-genius.md`\n**Target Folder**: Media/YouTube/";
/**
 * Default skill file location
 */
export declare function getDefaultSkillPath(): string;
/**
 * Extract youtube-transcript note formatting instructions from obsidian-note-creator
 * SKILL.md content. Returns null if any required section cannot be found.
 */
export declare function extractInstructionsFromSkill(skillContent: string): string | null;
/**
 * Get youtube-transcript note formatting instructions: extracted from the user's
 * obsidian-note-creator skill when available, otherwise the embedded fallback.
 * Never throws.
 */
export declare function extractSkillInstructions(skillPath?: string): Promise<string>;
//# sourceMappingURL=skill-extractor.d.ts.map