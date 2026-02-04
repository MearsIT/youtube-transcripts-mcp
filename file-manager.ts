import { promises as fs } from 'fs';
import { join } from 'path';

// Default output directory - Obsidian transcripts folder
const DEFAULT_CAPTIONS_DIR = 'H:\\Documents\\Obsidian\\METJM\\Transcripts\\yt';

/**
 * Save cleaned captions to the filesystem
 */
export async function saveToFilesystem(
  content: string,
  filename: string,
  outputDir?: string
): Promise<string> {
  const logger = {
    info: (msg: string, context?: any) =>
      console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
    error: (msg: string, err?: Error) =>
      console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, err?.stack || '')
  };

  try {
    // Set output directory (default to captions-dl folder in project)
    const saveDir = outputDir || DEFAULT_CAPTIONS_DIR;
    await fs.mkdir(saveDir, { recursive: true });

    // Ensure filename has .txt extension
    const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    const fullPath = join(saveDir, finalFilename);

    // Save file
    await fs.writeFile(fullPath, content, 'utf-8');

    logger.info('File saved successfully', { filePath: fullPath });
    return fullPath;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('File save failed', error instanceof Error ? error : new Error(errorMessage));
    throw new Error(`Failed to save file: ${errorMessage}`);
  }
}

/**
 * Generate a summary of text content
 */
export function generateSummary(text: string): {
  summary: string;
  wordCount: number;
  characterCount: number;
  estimatedReadingTime: number;
  keyPhrases: string[];
} {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const characterCount = text.length;

  // Estimate reading time (average 200 words per minute)
  const estimatedReadingTime = Math.ceil(wordCount / 200);

  // Simple key phrase extraction (words longer than 5 characters, frequency > 1)
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord.length > 5) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });

  const keyPhrases = Object.entries(wordFreq)
    .filter(([_, count]) => count > 1)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  // Generate a simple summary (first few sentences and key statistics)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const firstFewSentences = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');

  const summary = `**Content Summary:**

${firstFewSentences}

**Statistics:**
- Word Count: ${wordCount.toLocaleString()}
- Character Count: ${characterCount.toLocaleString()}
- Estimated Reading Time: ${estimatedReadingTime} minute${estimatedReadingTime !== 1 ? 's' : ''}
- Total Sentences: ${sentences.length}

**Key Topics:** ${keyPhrases.length > 0 ? keyPhrases.join(', ') : 'No significant recurring topics identified'}`;

  return {
    summary,
    wordCount,
    characterCount,
    estimatedReadingTime,
    keyPhrases
  };
}

/**
 * Create a timestamped filename
 */
export function createTimestampedFilename(baseFilename: string, extension: string = 'txt'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const cleanBase = baseFilename.replace(/[^\w\s-]/g, '').trim();
  return `${cleanBase}_${timestamp}.${extension}`;
}
