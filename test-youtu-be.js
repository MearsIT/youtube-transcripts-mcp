#!/usr/bin/env node

import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_URL = process.argv[2] || 'https://youtu.be/gf0AVhA3phc';
const TRANSCRIPTS_DIR = '/home/jandal/Documents/Obsidian/METJM/Transcripts/yt';
const TIMEOUT_MS = 90000;

const idMatch = TEST_URL.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
const videoId = idMatch ? idMatch[1] : null;

if (!videoId) {
  console.error(`❌ Could not extract video ID from URL: ${TEST_URL}`);
  process.exit(1);
}

let beforeSnapshot = new Set();
try {
  beforeSnapshot = new Set(readdirSync(TRANSCRIPTS_DIR));
} catch {}

const serverPath = join(__dirname, 'build', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseBuffer = '';
let stderrBuffer = '';
let messageId = 0;
let ytdlpCommandSeen = false;
let finished = false;

const fail = (msg) => {
  console.error(`❌ ${msg}`);
};

const finish = (code) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeoutTimer);
  if (!server.killed) server.kill();
  process.exit(code);
};

const timeoutTimer = setTimeout(() => {
  fail(`Timed out after ${TIMEOUT_MS / 1000}s waiting for tool response`);
  finish(1);
}, TIMEOUT_MS);

const sendInitialize = () => {
  const request = {
    jsonrpc: '2.0',
    id: ++messageId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-youtu-be', version: '1.0.0' }
    }
  };
  server.stdin.write(JSON.stringify(request) + '\n');
};

const sendToolCall = () => {
  const request = {
    jsonrpc: '2.0',
    id: ++messageId,
    method: 'tools/call',
    params: {
      name: 'process-youtube-captions',
      arguments: { url: TEST_URL }
    }
  };
  console.log(`⏳ Calling process-youtube-captions with ${TEST_URL} (this may take 30-60s)...\n`);
  server.stdin.write(JSON.stringify(request) + '\n');
};

const verifySessionFiles = () => {
  let ok = true;

  if (!ytdlpCommandSeen) {
    fail(`yt-dlp command containing ${TEST_URL} not found in stderr logs`);
    ok = false;
  }

  let entries;
  try {
    entries = readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  } catch (err) {
    fail(`Cannot read transcripts dir ${TRANSCRIPTS_DIR}: ${err.message}`);
    return finish(1);
  }

  const sessionNames = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{4,6}_/.test(e.name) && !beforeSnapshot.has(e.name))
    .map(e => e.name)
    .sort();
  const sessionName = sessionNames[sessionNames.length - 1];

  if (!sessionName) {
    fail(`No new session folder (YYYY-MM-DD_HHmm[ss]_<title>) created in ${TRANSCRIPTS_DIR}`);
    return finish(1);
  }
  console.log(`✓ Session folder created: ${sessionName}`);

  const sessionPath = join(TRANSCRIPTS_DIR, sessionName);
  const sessionFiles = readdirSync(sessionPath);

  const vttFile = sessionFiles.find(f => f.endsWith('.vtt') && f.includes(`_${videoId}.en`));
  if (!vttFile) {
    fail(`No VTT file matching *_${videoId}.en*.vtt found (files: ${sessionFiles.join(', ')})`);
    ok = false;
  } else {
    console.log(`✓ VTT file found: ${vttFile}`);
  }

  // Cleaned text IS written to disk by the tool: youtube-tools.ts saves it via
  // saveToFilesystem as a timestamped <title>_<timestamp>.txt file in the session
  // folder, so we check for a .txt file there rather than only the response text
  const txtFile = sessionFiles.find(f => f.endsWith('.txt'));
  if (!txtFile) {
    fail(`No cleaned text file (.txt) found in session folder (files: ${sessionFiles.join(', ')})`);
    ok = false;
  } else {
    console.log(`✓ Cleaned text file found: ${txtFile}`);
  }

  if (!ok) return finish(1);
  console.log('\n✓ Caption download successful');
  finish(0);
};

const handleToolResponse = (message) => {
  if (message.error) {
    fail(`JSON-RPC error: ${JSON.stringify(message.error)}`);
    return finish(1);
  }

  const result = message.result;
  const textItem = result && Array.isArray(result.content)
    ? result.content.find(item => item.type === 'text')
    : null;

  if (!textItem || !textItem.text) {
    fail('Response has no result.content text item or text is empty');
    return finish(1);
  }

  console.log('--- Response text (first 500 chars) ---');
  console.log(textItem.text.substring(0, 500) + (textItem.text.length > 500 ? '...' : ''));
  console.log('---------------------------------------\n');

  if (result.isError) {
    fail('Tool response has isError: true');
    return finish(1);
  }
  console.log('✓ Tool response is a success (isError not set)');

  verifySessionFiles();
};

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  lines.forEach(line => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === 1 && message.result) sendToolCall();
    else if (message.id === 2) handleToolResponse(message);
  });
});

server.stderr.on('data', (data) => {
  stderrBuffer += data.toString();
  const lines = stderrBuffer.split('\n');
  stderrBuffer = lines.pop() || '';
  lines.forEach(line => {
    if (!line.trim()) return;
    if (line.includes('[ERROR]')) console.error(`❌ stderr: ${line.trim()}`);
    if (line.includes('Executing yt-dlp command') && line.includes(TEST_URL) && !ytdlpCommandSeen) {
      ytdlpCommandSeen = true;
      console.log(`✓ yt-dlp command received the test URL: ${TEST_URL}`);
    }
  });
});

server.on('error', (err) => {
  fail(`Failed to spawn server: ${err.message}`);
  finish(1);
});

server.on('exit', (code) => {
  if (!finished) {
    fail(`Server process exited unexpectedly (code ${code})`);
    finish(1);
  }
});

console.log(`🚀 Verifying youtu.be URL support: ${TEST_URL}`);
console.log(`   Video ID: ${videoId}\n`);
sendInitialize();
