import { promises as fs } from 'fs';
/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': ' '
    };
    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
        decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    // Also decode numeric entities like &#8217;
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
        return String.fromCharCode(dec);
    });
    return decoded;
}
/**
 * Clean a VTT subtitle file by extracting only the actual caption text.
 */
export async function cleanVttFile(inputFile, outputFile) {
    const logger = {
        info: (msg, context) => console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
        error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, err?.stack || '')
    };
    const cleanedLines = [];
    try {
        logger.info('Starting VTT file cleaning', { inputFile });
        const fileContent = await fs.readFile(inputFile, 'utf-8');
        const lines = fileContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Skip empty lines
            if (!trimmedLine) {
                continue;
            }
            // Skip header lines (WEBVTT, Kind:, Language:)
            if (trimmedLine.startsWith('WEBVTT') ||
                trimmedLine.startsWith('Kind:') ||
                trimmedLine.startsWith('Language:')) {
                continue;
            }
            // Skip timestamp lines (contains --> and align:start position:)
            if (trimmedLine.includes('-->') && trimmedLine.includes('align:start position:')) {
                continue;
            }
            // Skip lines that are just timestamps without text
            if (/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/.test(trimmedLine)) {
                continue;
            }
            // Process lines that might contain timing markup
            if (trimmedLine.includes('<') && trimmedLine.includes('>')) {
                // Remove all timing markup (anything between < and >)
                let cleanedLine = trimmedLine.replace(/<[^>]*>/g, '');
                // Clean up any extra spaces
                cleanedLine = cleanedLine.replace(/\s+/g, ' ').trim();
                // Decode HTML entities
                cleanedLine = decodeHtmlEntities(cleanedLine);
                // Only add if there's actual text content after cleaning
                if (cleanedLine) {
                    cleanedLines.push(cleanedLine);
                }
            }
            else {
                // This is likely a clean caption line
                // But let's make sure it's not just a number or timestamp
                if (!/^\d+$/.test(trimmedLine) && !/^\d{2}:\d{2}:\d{2}/.test(trimmedLine)) {
                    // Decode HTML entities
                    const decodedLine = decodeHtmlEntities(trimmedLine);
                    cleanedLines.push(decodedLine);
                }
            }
        }
        // Remove duplicates while preserving order
        const seen = new Set();
        const uniqueLines = cleanedLines.filter(line => {
            if (seen.has(line)) {
                return false;
            }
            seen.add(line);
            return true;
        });
        logger.info('VTT cleaning completed', {
            originalLines: lines.length,
            cleanedLines: uniqueLines.length
        });
        // Write to output file if specified
        if (outputFile) {
            await fs.writeFile(outputFile, uniqueLines.join('\n') + '\n', 'utf-8');
            logger.info('Cleaned text saved to file', { outputFile });
        }
        return uniqueLines;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('VTT cleaning failed', error instanceof Error ? error : new Error(errorMessage));
        throw new Error(`Failed to clean VTT file: ${errorMessage}`);
    }
}
/**
 * Join cleaned caption lines into a single text string
 */
export function joinCaptions(captions, separator = ' ') {
    return captions.join(separator);
}
/**
 * Generate a summary of caption statistics
 */
export function getCaptionStats(captions) {
    const totalLines = captions.length;
    const totalWords = captions.reduce((sum, line) => sum + line.split(/\s+/).length, 0);
    const totalCharacters = captions.reduce((sum, line) => sum + line.length, 0);
    const averageWordsPerLine = totalLines > 0 ? totalWords / totalLines : 0;
    return {
        totalLines,
        totalWords,
        totalCharacters,
        averageWordsPerLine: Math.round(averageWordsPerLine * 100) / 100
    };
}
//# sourceMappingURL=caption-cleaner.js.map