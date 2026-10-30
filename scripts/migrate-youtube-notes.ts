import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { basename, extname, join } from 'path';

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
const SUBTOPIC_KEYWORDS: { folder: string; keywords: string[] }[] = [
  { folder: 'Technology', keywords: ['davinci', 'resolve', 'claude code', 'claude', 'openai', 'omarchy', 'programmer', 'programming', 'ai-', 'ai ', 'rust', 'developer', 'coding', 'software engineer', 'reverse engineering'] },
  { folder: 'Finance', keywords: ['council tax', 'mortgage', 'pension', 'wealth rant', 'property tax', 'pay yourself', 'tax strategy', 'tax adviser', 'hmrc'] },
  { folder: 'DND', keywords: ['dungeon', 'd&d', 'dnd session', 'campaign'] },
  { folder: 'UI', keywords: ['ui-ux', 'ui/ux', 'user interface'] },
  { folder: 'Laptop', keywords: ['gaming laptop', 'rtx laptop'] },
  { folder: 'Guides', keywords: ['dataview guide', 'obsidian bases'] },
];

const STOPWORDS = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'how', 'what', 'why', 'are', 'you', 'your', 'about']);

export interface RawFileInfo {
  path: string;
  filename: string;
  content: string;
  mtime: Date;
}

export interface ManifestEntry {
  sourcePath: string;
  title: string;
  isStrayTxt: boolean;
  proposedFolder: string;
  proposedFilename: string;
  dateSource: 'filename' | 'frontmatter' | 'mtime';
  duplicateClusterId: number | null;
}

/** Normalize a title into a set of significant words for duplicate-cluster detection. */
export function normalizeTitleWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words);
}

/** Jaccard similarity on significant words; two entries are a duplicate cluster at >=0.25 with >=2 shared words. */
export function titlesAreDuplicates(a: Set<string>, b: Set<string>): boolean {
  const shared = [...a].filter(w => b.has(w));
  if (shared.length < 2) return false;
  const union = new Set([...a, ...b]);
  const jaccard = shared.length / union.size;
  return jaccard >= 0.25;
}

/** Conservative topic match against existing Reference/<Topic>/ subfolders only; null means no clear match. */
export function matchSubtopic(title: string): string | null {
  const lower = title.toLowerCase();
  for (const { folder, keywords } of SUBTOPIC_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return folder;
  }
  return null;
}

/** Extract a leading YYYY-MM-DD(_HHMM)? date prefix from a filename, when present and parseable. */
export function parseFilenameDatePrefix(filename: string): Date | null {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})[_-](?:(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Extract the `created:` frontmatter date, when present and parseable (format YYYY-MM-DD-HH:MM). */
export function parseFrontmatterCreatedDate(content: string): Date | null {
  const match = content.match(/^created:\s*(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})\s*$/m);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function kebabCase(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildCanonicalFilename(date: Date, title: string): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${datePart}_${timePart}-${kebabCase(title) || 'video'}.md`;
}

/** Derive a display title from a filename (strips date prefix/extension, de-slugs). */
export function titleFromFilename(filename: string): string {
  let name = filename.replace(/\.(md|txt)$/i, '');
  name = name.replace(/^\d{4}-\d{2}-\d{2}[_-](?:\d{4}-)?/, '');
  name = name.replace(/[_-]+/g, ' ').trim();
  return name;
}

/** Resolve a target path against already-used paths, appending a disambiguating suffix on collision. */
export function resolveCollisionPath(targetPath: string, usedPaths: Set<string>): string {
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
export function computeManifest(files: RawFileInfo[]): ManifestEntry[] {
  const nonTxt = files.filter(f => !f.filename.toLowerCase().endsWith('.txt'));
  const strayTxt = files.filter(f => f.filename.toLowerCase().endsWith('.txt'));

  const titles = nonTxt.map(f => titleFromFilename(f.filename));
  const wordSets = titles.map(normalizeTitleWords);
  const clusterOf = new Map<number, number>();
  let nextClusterId = 1;
  for (let i = 0; i < nonTxt.length; i++) {
    for (let j = i + 1; j < nonTxt.length; j++) {
      if (titlesAreDuplicates(wordSets[i], wordSets[j])) {
        const existing = clusterOf.get(i) ?? clusterOf.get(j);
        const clusterId = existing ?? nextClusterId++;
        clusterOf.set(i, clusterId);
        clusterOf.set(j, clusterId);
      }
    }
  }

  const usedPaths = new Set<string>();
  const entries: ManifestEntry[] = [];

  for (let i = 0; i < nonTxt.length; i++) {
    const file = nonTxt[i];
    const title = titles[i];

    const filenameDate = parseFilenameDatePrefix(file.filename);
    const frontmatterDate = filenameDate ? null : parseFrontmatterCreatedDate(file.content);
    const date = filenameDate ?? frontmatterDate ?? file.mtime;
    const dateSource: ManifestEntry['dateSource'] = filenameDate ? 'filename' : frontmatterDate ? 'frontmatter' : 'mtime';

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

async function scanDirectory(dir: string): Promise<RawFileInfo[]> {
  const names = await fs.readdir(dir);
  const files: RawFileInfo[] = [];
  for (const filename of names) {
    const path = join(dir, filename);
    const stat = await fs.stat(path);
    if (!stat.isFile()) continue;
    const content = filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.txt')
      ? await fs.readFile(path, 'utf-8')
      : '';
    files.push({ path, filename, content, mtime: stat.mtime });
  }
  return files;
}

export async function buildManifestFromVault(): Promise<ManifestEntry[]> {
  const mediaFiles = await scanDirectory(MEDIA_YOUTUBE_DIR);
  let referenceFiles: RawFileInfo[] = [];
  try {
    referenceFiles = await scanDirectory(REFERENCE_YOUTUBE_DIR);
  } catch {
    // Reference/YouTube/ may not exist yet on a fresh vault; treat as empty.
  }
  return computeManifest([...mediaFiles, ...referenceFiles]);
}

async function hashFile(path: string): Promise<string> {
  const content = await fs.readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

export interface MigrationLogEntry extends ManifestEntry {
  outcome: 'moved' | 'failed';
  error?: string;
}

/** Copy-verify-delete a single entry (KTD4): never deletes the source until the copy is proven identical. */
export async function applyEntry(entry: ManifestEntry): Promise<MigrationLogEntry> {
  const targetPath = join(entry.proposedFolder, entry.proposedFilename);
  try {
    await fs.mkdir(entry.proposedFolder, { recursive: true });
    await fs.copyFile(entry.sourcePath, targetPath);

    const sourceHash = await hashFile(entry.sourcePath);
    const targetHash = await hashFile(targetPath);
    if (sourceHash !== targetHash) {
      await fs.rm(targetPath, { force: true });
      return { ...entry, outcome: 'failed', error: 'hash mismatch after copy; source left in place' };
    }

    await fs.unlink(entry.sourcePath);
    return { ...entry, outcome: 'moved' };
  } catch (error) {
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

  const existing = JSON.parse(await fs.readFile(REPORT_PATH, 'utf-8')) as { entries: ManifestEntry[] };
  const log: MigrationLogEntry[] = [];
  for (const entry of existing.entries) {
    log.push(await applyEntry(entry));
  }
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
