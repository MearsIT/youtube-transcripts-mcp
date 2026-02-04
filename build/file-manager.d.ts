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
//# sourceMappingURL=file-manager.d.ts.map