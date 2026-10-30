import { promises as fs, constants as fsConstants } from 'fs';
import { createHash } from 'crypto';
import { basename, extname, join } from 'path';
import { buildCanonicalFilename } from '../file-manager.js';
export const VAULT_ROOT = '/home/jandal/Documents/Obsidian/METJM';
export const MEDIA_YOUTUBE_DIR = join(VAULT_ROOT, 'Media/YouTube');
export const REFERENCE_YOUTUBE_DIR = join(VAULT_ROOT, 'Reference/YouTube');
export const TRANSCRIPTS_YT_DIR = join(VAULT_ROOT, 'Transcripts/yt');
export const REPORT_PATH = join(process.cwd(), 'migration-report.json');
/**
 * Conservative keyword -> existing Reference/<Topic>/ subfolder map (KTD5).
 * Keywords are deliberately narrow: a generic word like "guide" would
 * misclassify unrelated videos, so each keyword is distinctive to its topic.
 */
const SUBTOPIC_KEYWORDS = [
    { folder: 'Technology', keywords: ['davinci resolve', 'claude code', 'claude', 'openai', 'omarchy', 'programmer', 'programming', 'ai-', 'ai ', 'rust', 'developer', 'coding', 'software engineer', 'reverse engineering'] },
    { folder: 'Finance', keywords: ['council tax', 'mortgage', 'pension', 'wealth rant', 'property tax', 'pay yourself', 'tax strategy', 'tax adviser', 'hmrc'] },
    { folder: 'DND', keywords: ['dungeon', 'd&d', 'dnd session', 'dnd campaign', 'd&d campaign'] },
    { folder: 'UI', keywords: ['ui-ux', 'ui/ux', 'user interface'] },
    { folder: 'Laptop', keywords: ['gaming laptop', 'rtx laptop'] },
    { folder: 'Guides', keywords: ['dataview guide', 'obsidian bases'] },
    { folder: 'Equipment', keywords: ['mrs-1608', 'mrs 1608'] },
];
const STOPWORDS = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'how', 'what', 'why', 'are', 'you', 'your', 'about']);
/** Normalize a title into a set of significant words for duplicate-cluster detection. */
export function normalizeTitleWords(title) {
    const words = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w));
    return new Set(words);
}
/** Jaccard similarity on significant words; two entries are a duplicate cluster at >=0.25 with >=2 shared words. */
export function titlesAreDuplicates(a, b) {
    const shared = [...a].filter(w => b.has(w));
    if (shared.length < 2)
        return false;
    const union = new Set([...a, ...b]);
    const jaccard = shared.length / union.size;
    return jaccard >= 0.25;
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Word-boundary match for a keyword against a lowercased title. Plain substring matching would
 * match "rust" inside "frustrating" or "resolve" inside "I resolve to..."; \b anchors the keyword
 * to whole-word occurrences so a short, common-looking keyword can't fire on an unrelated word.
 */
function containsKeyword(lower, keyword) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(lower);
}
/** Conservative topic match against existing Reference/<Topic>/ subfolders only; null means no clear match. */
export function matchSubtopic(title) {
    const lower = title.toLowerCase();
    for (const { folder, keywords } of SUBTOPIC_KEYWORDS) {
        if (keywords.some(k => containsKeyword(lower, k)))
            return folder;
    }
    return null;
}
/**
 * Shared "YYYY-MM-DD(_HHMM)?" filename-date-prefix pattern. A single source of truth for
 * both parseFilenameDatePrefix (extracts the date) and titleFromFilename (strips the prefix),
 * so the two can't silently drift out of sync with each other.
 */
const FILENAME_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})[_-](?:(\d{2})(\d{2}))?/;
/** Extract a leading YYYY-MM-DD(_HHMM)? date prefix from a filename, when present and parseable. */
export function parseFilenameDatePrefix(filename) {
    const match = filename.match(FILENAME_DATE_PREFIX);
    if (!match)
        return null;
    const [, y, m, d, hh, mm] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0);
    return Number.isNaN(date.getTime()) ? null : date;
}
/** Extract the `created:` frontmatter date, when present and parseable (format YYYY-MM-DD-HH:MM). */
export function parseFrontmatterCreatedDate(content) {
    const match = content.match(/^created:\s*(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})\s*$/m);
    if (!match)
        return null;
    const [, y, m, d, hh, mm] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    return Number.isNaN(date.getTime()) ? null : date;
}
/** Derive a display title from a filename (strips date prefix/extension, de-slugs). */
export function titleFromFilename(filename) {
    let name = filename.replace(/\.(md|txt)$/i, '');
    const dateMatch = name.match(FILENAME_DATE_PREFIX);
    if (dateMatch) {
        name = name.slice(dateMatch[0].length);
    }
    name = name.replace(/[_-]+/g, ' ').trim();
    return name;
}
/** Resolve a target path against already-used paths, appending a disambiguating suffix on collision. */
export function resolveCollisionPath(targetPath, usedPaths) {
    if (!usedPaths.has(targetPath)) {
        usedPaths.add(targetPath);
        return targetPath;
    }
    const ext = extname(targetPath);
    const base = targetPath.slice(0, -ext.length);
    let n = 2;
    let candidate = `${base}-${n}${ext}`;
    while (usedPaths.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}${ext}`;
    }
    usedPaths.add(candidate);
    return candidate;
}
/**
 * Build the manifest from already-read file info. Pure function (no fs access)
 * so it is unit-testable against synthetic RawFileInfo without a real vault.
 */
export function computeManifest(files) {
    // Only .md files are treated as notes and .txt files as stray transcripts (R8); any other
    // extension (image, backup, dotfile, ...) is left out of the manifest entirely rather than
    // silently renamed to .md -- scanDirectory only reads .md/.txt content, so anything else
    // reaching here has no note content to classify.
    const notes = files.filter(f => f.filename.toLowerCase().endsWith('.md'));
    const strayTxt = files.filter(f => f.filename.toLowerCase().endsWith('.txt'));
    const titles = notes.map(f => titleFromFilename(f.filename));
    const wordSets = titles.map(normalizeTitleWords);
    const clusterOf = new Map();
    let nextClusterId = 1;
    for (let i = 0; i < notes.length; i++) {
        for (let j = i + 1; j < notes.length; j++) {
            if (titlesAreDuplicates(wordSets[i], wordSets[j])) {
                const existing = clusterOf.get(i) ?? clusterOf.get(j);
                const clusterId = existing ?? nextClusterId++;
                clusterOf.set(i, clusterId);
                clusterOf.set(j, clusterId);
            }
        }
    }
    const usedPaths = new Set();
    const entries = [];
    for (let i = 0; i < notes.length; i++) {
        const file = notes[i];
        const title = titles[i];
        const filenameDate = parseFilenameDatePrefix(file.filename);
        const frontmatterDate = filenameDate ? null : parseFrontmatterCreatedDate(file.content);
        const date = filenameDate ?? frontmatterDate ?? file.mtime;
        const dateSource = filenameDate ? 'filename' : frontmatterDate ? 'frontmatter' : 'mtime';
        const subtopic = matchSubtopic(title);
        const folder = subtopic ? join(VAULT_ROOT, 'Reference', subtopic) : REFERENCE_YOUTUBE_DIR;
        const filename = buildCanonicalFilename(date, title);
        const targetPath = resolveCollisionPath(join(folder, filename), usedPaths);
        entries.push({
            sourcePath: file.path,
            title,
            isStrayTxt: false,
            proposedFolder: folder,
            proposedFilename: basename(targetPath),
            dateSource,
            duplicateClusterId: clusterOf.get(i) ?? null,
        });
    }
    for (const file of strayTxt) {
        entries.push({
            sourcePath: file.path,
            title: titleFromFilename(file.filename),
            isStrayTxt: true,
            proposedFolder: TRANSCRIPTS_YT_DIR,
            proposedFilename: file.filename,
            dateSource: 'filename',
            duplicateClusterId: null,
        });
    }
    return entries;
}
async function scanDirectory(dir) {
    const names = await fs.readdir(dir);
    const files = await Promise.all(names.map(async (filename) => {
        const path = join(dir, filename);
        const stat = await fs.stat(path);
        if (!stat.isFile())
            return null;
        const content = filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.txt')
            ? await fs.readFile(path, 'utf-8')
            : '';
        return { path, filename, content, mtime: stat.mtime };
    }));
    return files.filter((f) => f !== null);
}
export async function buildManifestFromVault() {
    const [mediaResult, referenceResult] = await Promise.allSettled([
        scanDirectory(MEDIA_YOUTUBE_DIR),
        scanDirectory(REFERENCE_YOUTUBE_DIR),
    ]);
    if (mediaResult.status === 'rejected')
        throw mediaResult.reason;
    const mediaFiles = mediaResult.value;
    // Reference/YouTube/ may not exist yet on a fresh vault; treat that as empty.
    const referenceFiles = referenceResult.status === 'fulfilled' ? referenceResult.value : [];
    return computeManifest([...mediaFiles, ...referenceFiles]);
}
async function hashFile(path) {
    const content = await fs.readFile(path);
    return createHash('sha256').update(content).digest('hex');
}
/**
 * Copy-verify-delete a single entry (KTD4): never deletes the source until the copy is proven
 * identical. COPYFILE_EXCL makes the copy itself fail (EEXIST) if an unrelated file already sits
 * at the target path, rather than silently overwriting it -- collision detection during manifest
 * generation only tracks paths proposed within the same run, never pre-existing files on disk.
 */
export async function applyEntry(entry) {
    const targetPath = join(entry.proposedFolder, entry.proposedFilename);
    try {
        await fs.mkdir(entry.proposedFolder, { recursive: true });
        try {
            await fs.copyFile(entry.sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
        }
        catch (copyError) {
            if (copyError.code === 'EEXIST') {
                return { ...entry, outcome: 'failed', error: `target path already exists; refusing to overwrite: ${targetPath}` };
            }
            throw copyError;
        }
        const sourceHash = await hashFile(entry.sourcePath);
        const targetHash = await hashFile(targetPath);
        if (sourceHash !== targetHash) {
            await fs.rm(targetPath, { force: true });
            return { ...entry, outcome: 'failed', error: 'hash mismatch after copy; source left in place' };
        }
        await fs.unlink(entry.sourcePath);
        return { ...entry, outcome: 'moved' };
    }
    catch (error) {
        return { ...entry, outcome: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
}
async function main() {
    const apply = process.argv.includes('--apply');
    if (!apply) {
        const manifest = await buildManifestFromVault();
        await fs.writeFile(REPORT_PATH, JSON.stringify({ mode: 'manifest', entries: manifest }, null, 2), 'utf-8');
        console.log(`Manifest written to ${REPORT_PATH} (${manifest.length} entries, no files changed). Review it, then re-run with --apply.`);
        return;
    }
    const existing = JSON.parse(await fs.readFile(REPORT_PATH, 'utf-8'));
    const log = await Promise.all(existing.entries.map(applyEntry));
    await fs.writeFile(REPORT_PATH, JSON.stringify({ mode: 'applied', entries: log }, null, 2), 'utf-8');
    const failed = log.filter(l => l.outcome === 'failed').length;
    console.log(`Migration applied: ${log.length - failed} moved, ${failed} failed. Log written to ${REPORT_PATH}.`);
}
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    main().catch(error => {
        console.error('Migration script failed:', error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=migrate-youtube-notes.js.map