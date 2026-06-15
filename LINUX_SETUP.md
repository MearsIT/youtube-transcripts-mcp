# YouTube Transcripts MCP Server - Linux Setup

✅ Successfully configured for Linux (Arch)

## Configuration

### Claude Desktop Config
Location: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youtube-transcripts": {
      "command": "node",
      "args": ["/home/jandal/Projects/MCP/youtube-transcripts-mcp/build/index.js"]
    }
  }
}
```

### Output Directory
Default: `/home/jandal/Documents/Obsidian/METJM/Transcripts/yt`

Files are organized in date-stamped session folders:
```
/home/jandal/Documents/Obsidian/METJM/Transcripts/yt/
  └── 2026-06-15_0912_Video_Title/
      ├── Video_Title.txt          # Cleaned transcript
      └── Video_Title.en.vtt       # Raw VTT file (if requested)
```

## Dependencies

### Required
- ✅ Node.js v18+ (you have v26.2.0)
- ✅ yt-dlp (installed via pacman)

### Optional (Recommended)
- `python-curl_cffi` - For browser impersonation to avoid rate limits
  ```bash
  sudo pacman -S python-curl_cffi
  ```

## Known Issues & Solutions

### Rate Limiting (HTTP 429)
YouTube may rate limit requests, especially for popular videos. Solutions:

1. **Install python-curl_cffi** (recommended):
   ```bash
   sudo pacman -S python-curl_cffi
   ```

2. **Wait and retry** - The server will still work, just try again in a few minutes

3. **Use less popular videos** - Heavily watched videos are more likely to hit rate limits

### Browser Impersonation Warnings
If you see warnings about impersonation, install `python-curl_cffi`:
```bash
sudo pacman -S python-curl_cffi
```

## Testing

### Health Check
The server includes 5 tools:
1. `health-check` - Verify server is running
2. `process-youtube-captions` - Complete workflow (download, clean, save, summarize)
3. `download-youtube-captions` - Download raw VTT files only
4. `clean-vtt-file` - Clean existing VTT files
5. `save-formatted-transcript` - Save Claude-formatted transcripts

### Test Command
```bash
cd /home/jandal/Projects/MCP/youtube-transcripts-mcp
node test-simple.js
```

### Manual Test with yt-dlp
```bash
yt-dlp --write-auto-sub --sub-lang "en" --skip-download \
  --no-cache-dir --ignore-errors \
  "https://www.youtube.com/watch?v=jNQXAC9IVRw"
```

## Usage in Claude Desktop

After restarting Claude Desktop, you can use commands like:

```
Process this YouTube video: https://www.youtube.com/watch?v=jNQXAC9IVRw
```

```
Download captions from this video and summarize it
```

```
Run a health check on the YouTube transcripts server
```

## Building

After making code changes:
```bash
npm run build
```

## Troubleshooting

1. **"Tool not found"** - Restart Claude Desktop after config changes

2. **"yt-dlp not found"** - Run `which yt-dlp` to verify installation

3. **Permission errors** - Check that output directory exists and is writable:
   ```bash
   ls -la /home/jandal/Documents/Obsidian/METJM/Transcripts/yt
   ```

4. **Rate limits** - Wait a few minutes or try a different video

## Files Modified for Linux

- `youtube-downloader.ts:8` - Changed default path from Windows to Linux
- `file-manager.ts:5` - Changed default path from Windows to Linux
- `youtube-downloader.ts:85-98` - Added error handling for rate limits

## Next Steps

1. **Install python-curl_cffi** to reduce rate limiting issues
2. **Restart Claude Desktop** to activate the MCP server
3. **Test with a video** in Claude Desktop

Enjoy! 🎬
