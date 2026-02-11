/**
 * Downloads YouTube captions using yt-dlp
 * @param url YouTube video URL
 * @param outputDir Directory to save captions (optional)
 * @returns Promise<string> Path to the downloaded VTT file
 */
export declare function downloadYouTubeCaptions(url: string, outputDir?: string): Promise<string>;
/**
 * Validates if a string is a valid YouTube URL
 */
export declare function isValidYouTubeUrl(url: string): boolean;
/**
 * Extracts video ID from YouTube URL
 */
export declare function extractVideoId(url: string): string | null;
//# sourceMappingURL=youtube-downloader.d.ts.map