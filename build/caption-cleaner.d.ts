/**
 * Clean a VTT subtitle file by extracting only the actual caption text.
 */
export declare function cleanVttFile(inputFile: string, outputFile?: string): Promise<string[]>;
/**
 * Join cleaned caption lines into a single text string
 */
export declare function joinCaptions(captions: string[], separator?: string): string;
/**
 * Generate a summary of caption statistics
 */
export declare function getCaptionStats(captions: string[]): {
    totalLines: number;
    totalWords: number;
    totalCharacters: number;
    averageWordsPerLine: number;
};
//# sourceMappingURL=caption-cleaner.d.ts.map