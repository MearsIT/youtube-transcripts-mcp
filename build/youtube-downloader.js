import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
// Default output directory - Obsidian transcripts folder
const DEFAULT_CAPTIONS_DIR = 'H:\\Documents\\Obsidian\\METJM\\Transcripts\\yt';
const execAsync = promisify(exec);
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
        // Create unique session directory to avoid conflicts
        const sessionId = randomBytes(8).toString('hex');
        const baseWorkingDir = outputDir || DEFAULT_CAPTIONS_DIR;
        const workingDir = join(baseWorkingDir, `session_${sessionId}`);
        await fs.mkdir(workingDir, { recursive: true });
        logger.info('Starting YouTube caption download', { url, workingDir, sessionId });
        // Extract video ID for more specific targeting
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('Could not extract video ID from URL');
        }
        // Execute yt-dlp command with options for English captions
        const command = `yt-dlp --write-auto-sub --sub-lang "en.*" --skip-download --no-cache-dir --force-write-archive --output "${workingDir}/%(title)s_${videoId}.%(ext)s" "${url}"`;
        logger.info('Executing yt-dlp command', { command });
        const { stdout, stderr } = await execAsync(command, { timeout: 60000 }); // 60 second timeout
        if (stderr) {
            logger.info('yt-dlp stderr output', { stderr });
        }
        // Find the downloaded VTT file
        const files = await fs.readdir(workingDir);
        logger.info('Files found in working directory', { files });
        const vttFile = files.find(file => (file.endsWith('.en-orig.vtt') || file.endsWith('.en.vtt')) &&
            file.includes(videoId));
        if (!vttFile) {
            // Fallback: try any VTT file if video-specific search fails
            const anyVttFile = files.find(file => file.endsWith('.vtt'));
            if (anyVttFile) {
                logger.info('Using fallback VTT file', { file: anyVttFile });
                const vttPath = join(workingDir, anyVttFile);
                return vttPath;
            }
            throw new Error(`No English captions found for video ID ${videoId}. Available files: ${files.join(', ')}`);
        }
        const vttPath = join(workingDir, vttFile);
        logger.info('Caption download completed', { vttFile: vttPath, sessionId });
        // Schedule cleanup of session directory after successful completion
        // Give some time for file to be processed before cleanup
        setTimeout(async () => {
            try {
                await cleanupSessionDirectory(workingDir);
                logger.info('Session directory cleaned up', { workingDir, sessionId });
            }
            catch (cleanupError) {
                logger.error('Failed to cleanup session directory', cleanupError instanceof Error ? cleanupError : new Error('Unknown cleanup error'));
            }
        }, 300000); // 5 minutes delay
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
function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[a-zA-Z0-9_-]{11}/;
    return youtubeRegex.test(url);
}
/**
 * Extracts video ID from YouTube URL
 */
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
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
/**
 * Cleanup session directory and its contents
 */
async function cleanupSessionDirectory(sessionDir) {
    try {
        const stat = await fs.stat(sessionDir);
        if (stat.isDirectory()) {
            const files = await fs.readdir(sessionDir);
            // Remove all files in directory
            for (const file of files) {
                const filePath = join(sessionDir, file);
                await fs.unlink(filePath);
            }
            // Remove directory itself
            await fs.rmdir(sessionDir);
        }
    }
    catch (error) {
        // Ignore cleanup errors - they're not critical
    }
}
//# sourceMappingURL=youtube-downloader.js.map