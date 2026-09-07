import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
// Default output directory - Obsidian transcripts folder
const DEFAULT_CAPTIONS_DIR = '/home/jandal/Documents/Obsidian/METJM/Transcripts/yt';
const execAsync = promisify(exec);
/**
 * Get video metadata (title) from yt-dlp
 */
async function getVideoMetadata(url) {
    const command = `yt-dlp --print "%(title)s" --print "%(id)s" "${url}"`;
    const { stdout } = await execAsync(command, { timeout: 30000 });
    const lines = stdout.trim().split('\n');
    return {
        title: lines[0] || 'unknown',
        videoId: lines[1] || ''
    };
}
/**
 * Create a filesystem-safe filename from text
 */
function sanitizeFilename(text, maxLength = 50) {
    return text
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .substring(0, maxLength) // Limit length
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}
/**
 * Create a date-stamped session ID with video title
 */
function createSessionId(videoTitle) {
    const now = new Date();
    const dateStamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '')
        .substring(0, 15); // YYYY-MM-DD_HHmmss
    const sanitizedTitle = sanitizeFilename(videoTitle);
    return `${dateStamp}_${sanitizedTitle}`;
}
/**
 * Downloads YouTube captions using yt-dlp
 * @param url YouTube video URL
 * @param outputDir Directory to save captions (optional)
 * @returns Promise<string> Path to the downloaded VTT file
 */
export async function downloadYouTubeCaptions(url, outputDir) {
    const logger = {
        info: (msg, context) => console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
        error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, err?.stack || '')
    };
    try {
        // Validate YouTube URL
        if (!isValidYouTubeUrl(url)) {
            throw new Error('Invalid YouTube URL provided');
        }
        // Get video metadata
        logger.info('Fetching video metadata', { url });
        const metadata = await getVideoMetadata(url);
        logger.info('Video metadata retrieved', { title: metadata.title, videoId: metadata.videoId });
        // Create date-stamped session directory
        const sessionId = createSessionId(metadata.title);
        const baseWorkingDir = outputDir || DEFAULT_CAPTIONS_DIR;
        const workingDir = join(baseWorkingDir, sessionId);
        await fs.mkdir(workingDir, { recursive: true });
        logger.info('Starting YouTube caption download', { url, workingDir, sessionId });
        // Execute yt-dlp command with options for English captions
        // Add retry logic and user agent to avoid rate limiting
        // Use --ignore-errors to continue even if some subtitle variants fail
        const command = `yt-dlp --write-auto-sub --sub-lang "en" --skip-download --no-cache-dir --ignore-errors --user-agent "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --extractor-retries 3 --output "${workingDir}/%(title)s_${metadata.videoId}.%(ext)s" "${url}"`;
        logger.info('Executing yt-dlp command', { command });
        let stdout = '';
        let stderr = '';
        try {
            const result = await execAsync(command, { timeout: 60000 }); // 60 second timeout
            stdout = result.stdout;
            stderr = result.stderr;
        }
        catch (error) {
            // Even if yt-dlp exits with error code, it might have downloaded some captions
            // Check if files were created successfully
            stdout = error.stdout || '';
            stderr = error.stderr || '';
            logger.info('yt-dlp completed with errors, checking for downloaded files', { stderr });
        }
        if (stderr) {
            logger.info('yt-dlp stderr output', { stderr });
        }
        // Find the downloaded VTT file
        const files = await fs.readdir(workingDir);
        logger.info('Files found in working directory', { files });
        const vttFile = files.find(file => (file.endsWith('.en-orig.vtt') || file.endsWith('.en.vtt')) &&
            file.includes(metadata.videoId));
        if (!vttFile) {
            // Fallback: try any VTT file if video-specific search fails
            const anyVttFile = files.find(file => file.endsWith('.vtt'));
            if (anyVttFile) {
                logger.info('Using fallback VTT file', { file: anyVttFile });
                const vttPath = join(workingDir, anyVttFile);
                return vttPath;
            }
            throw new Error(`No English captions found for video ID ${metadata.videoId}. Available files: ${files.join(', ')}`);
        }
        const vttPath = join(workingDir, vttFile);
        logger.info('Caption download completed', { vttFile: vttPath, sessionId });
        // Session directory persists (vtt + cleaned txt are kept for later reference)
        return vttPath;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Caption download failed', error instanceof Error ? error : new Error(errorMessage));
        throw new Error(`Failed to download YouTube captions: ${errorMessage}`);
    }
}
/**
 * Validates if a string is a valid YouTube URL
 */
export function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}/;
    return youtubeRegex.test(url);
}
/**
 * Extracts video ID from YouTube URL
 */
export function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}
//# sourceMappingURL=youtube-downloader.js.map