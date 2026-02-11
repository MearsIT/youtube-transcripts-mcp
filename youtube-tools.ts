import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { downloadYouTubeCaptions } from "./youtube-downloader.js";
import { cleanVttFile, joinCaptions, getCaptionStats } from "./caption-cleaner.js";
import { saveToFilesystem, generateSummary, createTimestampedFilename } from "./file-manager.js";

/**
 * Register YouTube caption processing tools
 */
export function registerYouTubeCaptionTools(server: McpServer) {
  const logger = {
    info: (msg: string, context?: any) =>
      console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
    error: (msg: string, err?: Error) =>
      console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, err?.stack || '')
  };

  // Main tool: Process YouTube video captions end-to-end
  server.registerTool(
    "process-youtube-captions",
    {
      title: "Process YouTube Captions",
      description: "Download, clean, save, and summarise YouTube video captions",
      inputSchema: {
        url: z.string().describe("YouTube video URL (supports standard, short, embed, and Shorts URLs)"),
        outputDir: z.string().optional().describe("Directory to save files (optional, defaults to H:\\Documents\\Obsidian\\METJM\\Transcripts\\yt)"),
        filename: z.string().optional().describe("Base filename for saved files (optional, auto-generated if not provided)"),
        includeRawCaptions: z.boolean().optional().describe("Whether to save raw VTT file alongside cleaned text (default: false)")
      } as any
    },
    async (args: any) => {
      const { url, outputDir, filename, includeRawCaptions = false } = args;
      const requestId = Math.random().toString(36).substring(2, 15);

      try {
        logger.info("Starting YouTube caption processing", {
          requestId,
          url,
          outputDir,
          filename,
          includeRawCaptions
        });

        // Step 1: Download captions
        const vttPath = await downloadYouTubeCaptions(url, outputDir);

        // Step 2: Clean captions
        const cleanedCaptions = await cleanVttFile(vttPath);
        const captionText = joinCaptions(cleanedCaptions);
        const stats = getCaptionStats(cleanedCaptions);

        // Step 3: Generate filename if not provided
        const videoTitle = extractVideoTitle(vttPath);
        const baseFilename = filename || createTimestampedFilename(videoTitle || 'youtube_captions');

        // Step 4: Save cleaned text to session folder (not main folder)
        // Extract session folder from vttPath
        const { dirname } = await import('path');
        const sessionFolder = dirname(vttPath);

        const cleanedTextPath = await saveToFilesystem(
          captionText,
          baseFilename,
          sessionFolder  // Save to session folder, not main folder
        );

        // Step 5: Save raw VTT if requested (also in session folder)
        let rawVttPath: string | undefined;
        if (includeRawCaptions) {
          const rawFilename = baseFilename.replace('.txt', '_raw.vtt');
          rawVttPath = await saveToFilesystem(
            await import('fs').then(fs => fs.promises.readFile(vttPath, 'utf-8')),
            rawFilename,
            sessionFolder  // Save to session folder
          );
        }

        logger.info("YouTube caption processing completed", {
          requestId,
          cleanedTextPath,
          rawVttPath,
          stats
        });

        return {
          content: [{
            type: "text" as const,
            text: `**YouTube Caption Processing Complete**

**Video URL:** ${url}
**Video Title:** ${videoTitle || 'Unknown'}

**Processing Statistics:**
- Cleaned lines: ${stats.totalLines}
- Total words: ${stats.totalWords.toLocaleString()}
- Total characters: ${stats.totalCharacters.toLocaleString()}

**Files Saved:**
- 📁 Session folder: ${sessionFolder}
- 📄 Cleaned text: [${cleanedTextPath}](file:///${cleanedTextPath.replace(/\\/g, '/')})
${rawVttPath ? `- 📄 Raw VTT: ${rawVttPath}` : ''}

---

**Full Cleaned Text:**
${captionText.length > 2000 ? captionText.substring(0, 2000) + '...\n\n[Text truncated - full content saved to file]' : captionText}`
          }]
        };

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("YouTube caption processing failed", error instanceof Error ? error : new Error(errorMessage));

        return {
          content: [{
            type: "text" as const,
            text: `**YouTube Caption Processing Failed**

Error: ${errorMessage}
Request ID: ${requestId}

Please ensure:
1. yt-dlp is installed and accessible
2. The YouTube URL is valid
3. The video has English captions available
4. You have write permissions to the output directory`
          }],
          isError: true
        };
      }
    }
  );

  // Utility tool: Download captions only
  server.registerTool(
    "download-youtube-captions",
    {
      title: "Download YouTube Captions",
      description: "Download raw VTT caption files from YouTube videos",
      inputSchema: {
        url: z.string().describe("YouTube video URL (supports standard, short, embed, and Shorts URLs)"),
        outputDir: z.string().optional().describe("Directory to save VTT file (optional)")
      } as any
    },
    async (args: any) => {
      const { url, outputDir } = args;
      try {
        const vttPath = await downloadYouTubeCaptions(url, outputDir);
        const videoTitle = extractVideoTitle(vttPath);

        return {
          content: [{
            type: "text" as const,
            text: `**Caption Download Complete**

Video: ${videoTitle || 'Unknown'}
VTT file saved to: ${vttPath}`
          }]
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{
            type: "text" as const,
            text: `Caption download failed: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // Utility tool: Clean existing VTT file
  server.registerTool(
    "clean-vtt-file",
    {
      title: "Clean VTT Caption File",
      description: "Clean an existing VTT file to extract readable text",
      inputSchema: {
        vttFilePath: z.string().describe("Path to the VTT file to clean"),
        outputPath: z.string().optional().describe("Path for cleaned text output (optional)")
      } as any
    },
    async (args: any) => {
      const { vttFilePath, outputPath } = args;
      try {
        const cleanedCaptions = await cleanVttFile(vttFilePath, outputPath);
        const captionText = joinCaptions(cleanedCaptions);
        const stats = getCaptionStats(cleanedCaptions);

        return {
          content: [{
            type: "text" as const,
            text: `**VTT Cleaning Complete**

Input file: ${vttFilePath}
${outputPath ? `Output file: ${outputPath}\n` : ''}Cleaned lines: ${stats.totalLines}
Total words: ${stats.totalWords}

**Preview:**
${captionText.substring(0, 500)}${captionText.length > 500 ? '...' : ''}`
          }]
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{
            type: "text" as const,
            text: `VTT cleaning failed: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // New tool: Save formatted transcript
  server.registerTool(
    "save-formatted-transcript",
    {
      title: "Save Formatted Transcript",
      description: "Save a formatted transcript (e.g., markdown formatted by Claude) to the filesystem",
      inputSchema: {
        content: z.string().describe("The formatted content to save"),
        filename: z.string().describe("Filename for the saved file (e.g., 'my_video.md')"),
        outputDir: z.string().optional().describe("Directory to save file (optional, defaults to H:\\Documents\\Obsidian\\METJM\\Transcripts\\yt)"),
        videoTitle: z.string().optional().describe("Video title for organization (optional)"),
        videoUrl: z.string().optional().describe("Video URL for reference (optional)")
      } as any
    },
    async (args: any) => {
      const { content, filename, outputDir, videoTitle, videoUrl } = args;
      try {
        logger.info("Saving formatted transcript", { filename, outputDir });

        const savedPath = await saveToFilesystem(content, filename, outputDir);

        logger.info("Formatted transcript saved successfully", { path: savedPath });

        return {
          content: [{
            type: "text" as const,
            text: `**Formatted Transcript Saved**

${videoTitle ? `**Video:** ${videoTitle}\n` : ''}${videoUrl ? `**URL:** ${videoUrl}\n` : ''}
**File:** [${savedPath}](file:///${savedPath.replace(/\\/g, '/')})
**Size:** ${content.length.toLocaleString()} characters

Your formatted transcript has been saved to your Obsidian folder!`
          }]
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{
            type: "text" as const,
            text: `Failed to save formatted transcript: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}

/**
 * Extract video title from VTT filename
 */
function extractVideoTitle(vttPath: string): string | null {
  try {
    const filename = vttPath.split(/[/\\]/).pop() || '';
    // Remove file extensions and clean up
    return filename
      .replace(/\.(en-orig\.vtt|en\.vtt|vtt)$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
  } catch {
    return null;
  }
}
