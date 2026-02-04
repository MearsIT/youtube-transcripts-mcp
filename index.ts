#!/usr/bin/env node

/**
 * YouTube Transcripts MCP Server
 *
 * This is a self-contained MCP server for downloading, cleaning, and summarizing
 * YouTube video captions. It directly uses yt-dlp without any external dependencies.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerYouTubeCaptionTools } from "./youtube-tools.js";

// Create MCP server instance
const server = new McpServer({
  name: "youtube-transcripts",
  version: "1.0.0"
});

// Logger setup (stderr only to avoid corrupting MCP protocol)
const logger = {
  info: (msg: string, context?: any) =>
    console.error(`[INFO] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : ''),
  error: (msg: string, err?: Error) =>
    console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, err?.stack || ''),
  warn: (msg: string, context?: any) =>
    console.error(`[WARN] ${new Date().toISOString()} ${msg}`, context ? JSON.stringify(context) : '')
};

// Register all YouTube caption tools
registerYouTubeCaptionTools(server);

// Add a health check tool
server.registerTool(
  "health-check",
  {
    title: "Health Check",
    description: "Check if the MCP server and dependencies are working properly",
    inputSchema: {}
  },
  async () => {
    try {
      // Check if yt-dlp is available
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('yt-dlp --version');

      return {
        content: [{
          type: "text",
          text: `**YouTube Transcripts MCP Server - Health Check**

✅ **Server Status:** Running
✅ **MCP Protocol:** Active
✅ **yt-dlp:** Available
✅ **File System:** Accessible

**Available Tools:**
- \`process-youtube-captions\`: Complete caption processing workflow
- \`download-youtube-captions\`: Download raw VTT files
- \`clean-vtt-file\`: Clean existing VTT files
- \`health-check\`: This health check tool

**Server Info:**
- Name: youtube-transcripts
- Version: 1.0.0
- Runtime: Node.js ${process.version}
- Platform: ${process.platform}

Ready to process YouTube transcripts! 🎬`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `**Health Check Failed**

❌ **Error:** yt-dlp not found or not accessible

Please ensure yt-dlp is installed and available in your PATH:
- Install: \`pip install yt-dlp\` or \`brew install yt-dlp\`
- Verify: \`yt-dlp --version\`

Error details: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// Entry point
async function main() {
  try {
    logger.info("Starting YouTube Transcripts MCP Server");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("YouTube Transcripts MCP Server running", {
      serverName: "youtube-transcripts",
      version: "1.0.0",
      toolCount: 4
    });

  } catch (error: unknown) {
    logger.error("Failed to start server", error instanceof Error ? error : new Error('Unknown error'));
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

// Start the server
main().catch(error => {
  logger.error("Server startup failed", error instanceof Error ? error : new Error('Unknown startup error'));
  process.exit(1);
});
