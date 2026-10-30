/**
 * Save cleaned captions to the filesystem
 */
export declare function saveToFilesystem(content: string, filename: string, outputDir?: string): Promise<string>;
/**
 * Generate a summary of text content
 */
export declare function generateSummary(text: string): {
    summary: string;
    wordCount: number;
    characterCount: number;
    estimatedReadingTime: number;
    keyPhrases: string[];
};
/**
 * Create a timestamped filename
 */
export declare function createTimestampedFilename(baseFilename: string, extension?: string): string;
/**
 * Kebab-case a title for use in a filename (lowercase, hyphenated, max 60 chars).
 */
export declare function kebabCase(title: string): string;
/**
 * Build the canonical `YYYY-MM-DD_HHMM-kebab-title.md` note filename for a given date/title.
 */
export declare function buildCanonicalFilename(date: Date, title: string): string;
//# sourceMappingURL=file-manager.d.ts.map