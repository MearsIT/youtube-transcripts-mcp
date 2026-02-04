# YouTube Transcripts MCP Server

A self-contained MCP server for downloading, cleaning, and summarizing YouTube video captions.

## Features

- 🎥 Download YouTube captions using yt-dlp
- 🧹 Clean VTT format (remove timestamps, HTML tags, duplicates)
- 📝 Generate summaries with reading time and key topics
- 🚀 Simple command-line interface
- 📦 Self-contained (no external MCP server dependencies)

## Prerequisites

### Required Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Node.js** | Runtime environment | Download from [nodejs.org](https://nodejs.org/) (v18 or higher) |
| **yt-dlp** | Download YouTube captions | `pip install yt-dlp` |

### Installing yt-dlp

```bash
# Using pip
pip install yt-dlp

# Using pip3
pip3 install yt-dlp

# On macOS with Homebrew
brew install yt-dlp

# On Linux
pip install yt-dlp
```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Claude Desktop Setup

Add this to your Claude Desktop config:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youtube-transcripts": {
      "command": "node",
      "args": ["H:\\MCP\\yt-transcripts\\build\\mcp-server.js"]
    }
  }
}
```

### Restart Claude Desktop

Close and reopen Claude Desktop for the changes to take effect.

## Available Tools

| Tool Name | Description |
|-----------|-------------|
| `process-youtube-captions` | Download, clean, save, and summarize YouTube video captions |
| `download-youtube-captions` | Download raw VTT caption files from YouTube videos |
| `clean-vtt-file` | Clean an existing VTT file to extract readable text |
| `health-check` | Check if the MCP server and dependencies are working properly |

## Usage Examples

### Example 1: Process a YouTube Video

Ask Claude:
> "Process this YouTube video: https://www.youtube.com/watch?v=dQw4w9WgXcQ"

Claude will:
1. Download captions using yt-dlp
2. Clean VTT formatting
3. Save cleaned text to filesystem
4. Generate summary with reading time
5. Return the transcript with statistics

### Example 2: Download Captions Only

Ask Claude:
> "Download the captions from this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ"

### Example 3: Clean Existing VTT File

Ask Claude:
> "Clean this VTT file: H:\\MCP\\captions-dl\\video.vtt"

### Example 4: Health Check

Ask Claude:
> "Run a health check on the YouTube transcripts server"

## Output Location

By default, all files are saved to:
```
H:\MCP\captions-dl\
```

You can specify a custom output directory when using the tools.

## File Structure

```
H:\MCP\yt-transcripts\
├── README.md                   # This file
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── mcp-server.ts              # Main MCP server
├── youtube-tools.ts           # Tool implementations
├── caption-cleaner.ts         # VTT cleaning utilities
├── file-manager.ts            # File operations
├── youtube-downloader.ts      # yt-dlp integration
└── build/                     # Compiled output
    ├── mcp-server.js
    ├── youtube-tools.js
    ├── caption-cleaner.js
    ├── file-manager.js
    └── youtube-downloader.js
```

## NPM Scripts

```bash
npm run build          # Compile TypeScript to JavaScript
npm run dev            # Watch mode - rebuild on file changes
npm run clean          # Remove build/ folder
```

## Troubleshooting

### "Tool not found" error

1. Check the path in `claude_desktop_config.json`
2. Ensure `build/mcp-server.js` exists (run `npm run build`)
3. Restart Claude Desktop

### "Server connection failed"

1. Ensure yt-dlp is installed: `yt-dlp --version`
2. Check Node.js version: `node --version` (must be v18 or higher)
3. Verify the server path in Claude Desktop config

### "No captions available"

1. Try a different video with captions
2. Check if the video is private or restricted
3. Verify network connection

## Benefits

- **Self-contained** - No external MCP server dependencies
- **Simple** - Direct implementation, no bridge layer
- **Fast** - No proxy overhead or progressive discovery
- **Easy to maintain** - Single codebase, clear structure
- **Works with Claude Desktop** - Pure MCP server

## Language Support

Currently configured for English captions only. The server automatically searches for English captions (`en.*`) when downloading videos.

## License

MIT
