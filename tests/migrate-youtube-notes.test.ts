import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  computeManifest,
  matchSubtopic,
  normalizeTitleWords,
  titlesAreDuplicates,
  parseFilenameDatePrefix,
  parseFrontmatterCreatedDate,
  resolveCollisionPath,
  titleFromFilename,
  applyEntry,
  type RawFileInfo,
  type ManifestEntry,
} from '../scripts/migrate-youtube-notes.js';

function file(filename: string, content = '', mtime = new Date('2026-03-02T21:00:00')): RawFileInfo {
  return { path: `/vault/Media/YouTube/${filename}`, filename, content, mtime };
}

describe('matchSubtopic', () => {
  it('matches a clear topic keyword to an existing Reference subtopic', () => {
    expect(matchSubtopic('DaVinci Resolve API Projects Timelines')).toBe('Technology');
  });

  it('returns null when no subtopic keyword is present', () => {
    expect(matchSubtopic('Why Younger People Are Getting Shingles')).toBeNull();
  });

  it('does not match a keyword that only occurs as a substring of an unrelated word', () => {
    expect(matchSubtopic('Why Everything Feels So Frustrating Lately')).toBeNull();
  });

  it('does not match a generic word that is ambiguous outside its intended topic', () => {
    expect(matchSubtopic('Local Election Campaign Explained')).toBeNull();
  });
});

describe('titlesAreDuplicates / normalizeTitleWords', () => {
  it('flags titles sharing enough significant words as a duplicate cluster', () => {
    const a = normalizeTitleWords('marco pierre white chopping an onion');
    const b = normalizeTitleWords('marco pierre white onion chopping technique');
    const c = normalizeTitleWords('marco responds how to chop an onion');
    expect(titlesAreDuplicates(a, b)).toBe(true);
    expect(titlesAreDuplicates(a, c)).toBe(true);
  });

  it('does not flag unrelated titles as duplicates', () => {
    const a = normalizeTitleWords('DaVinci Resolve API Projects Timelines');
    const b = normalizeTitleWords('Why Younger People Are Getting Shingles');
    expect(titlesAreDuplicates(a, b)).toBe(false);
  });
});

describe('parseFilenameDatePrefix / parseFrontmatterCreatedDate', () => {
  it('parses a YYYY-MM-DD_HHMM filename prefix', () => {
    const date = parseFilenameDatePrefix('2026-09-02_1639_jacob-collier-cult-of-genius.md');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(2);
  });

  it('returns null when no filename date prefix exists', () => {
    expect(parseFilenameDatePrefix('ARC Raiders - Recycling and Item Keeping Guide.md')).toBeNull();
  });

  it('parses a created: frontmatter date', () => {
    const content = '---\ntitle: Test\ncreated: 2025-03-25-00:00\n---\n';
    const date = parseFrontmatterCreatedDate(content);
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(25);
  });
});

describe('resolveCollisionPath', () => {
  it('returns the path unchanged when not already used', () => {
    const used = new Set<string>();
    expect(resolveCollisionPath('/a/b.md', used)).toBe('/a/b.md');
  });

  it('appends a disambiguating suffix on collision instead of overwriting', () => {
    const used = new Set<string>(['/a/b.md']);
    expect(resolveCollisionPath('/a/b.md', used)).toBe('/a/b-2.md');
  });

  it('keeps incrementing the suffix until a free path is found', () => {
    const used = new Set<string>(['/a/b.md', '/a/b-2.md']);
    expect(resolveCollisionPath('/a/b.md', used)).toBe('/a/b-3.md');
  });
});

describe('computeManifest', () => {
  it('proposes Reference/Technology for a clear topic match', () => {
    const entries = computeManifest([file('2026-03-23_DaVinci_Resolve_API_Projects_Timelines.md')]);
    expect(entries[0].proposedFolder).toMatch(/Reference\/Technology$/);
    expect(entries[0].proposedFilename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{4}-/);
  });

  it('falls back to Reference/YouTube when no topic matches', () => {
    const entries = computeManifest([file('Why Younger People Are Getting Shingles - Vlogbrothers.md')]);
    expect(entries[0].proposedFolder).toMatch(/Reference\/YouTube$/);
  });

  it('sources the date from created: frontmatter when the filename has no date prefix', () => {
    const content = '---\ntitle: James Webb Telescope\ncreated: 2025-03-25-00:00\n---\n';
    const entries = computeManifest([file('James Webb Telescope - Challenging Einsteins Cosmological Theory.md', content, new Date('2026-03-02'))]);
    expect(entries[0].dateSource).toBe('frontmatter');
    expect(entries[0].proposedFilename.startsWith('2025-03-25_')).toBe(true);
  });

  it('falls back to mtime only when no filename date and no usable frontmatter date exist', () => {
    const entries = computeManifest([file('Untitled Video Note.md', '---\ntitle: Untitled\n---\n', new Date('2026-03-02T21:27:00'))]);
    expect(entries[0].dateSource).toBe('mtime');
    expect(entries[0].proposedFilename.startsWith('2026-03-02_')).toBe(true);
  });

  it('flags a cluster of near-duplicate-titled files without merging or dropping any', () => {
    const entries = computeManifest([
      file('marco-pierre-white-chopping-an-onion.md'),
      file('marco-pierre-white-onion-chopping-technique.md'),
      file('2026-09-07-marco-responds-how-to-chop-an-onion.md'),
    ]);
    expect(entries).toHaveLength(3);
    const clusterIds = entries.map(e => e.duplicateClusterId);
    expect(clusterIds.every(id => id !== null)).toBe(true);
    expect(new Set(clusterIds).size).toBe(1);
  });

  it('gives a disambiguating suffix to the second of two entries that compute the identical target path', () => {
    // Same date+time prefix AND the same de-slugged title, so both genuinely compute the same
    // target path through computeManifest's own buildCanonicalFilename call -- not just two
    // files whose titles happen to differ (which would never collide in the first place).
    const sameMinute = new Date('2026-09-02T16:39:00');
    const entries = computeManifest([
      file('2026-09-02_1639_my-video.md', '', sameMinute),
      file('2026-09-02_1639_My_Video.md', '', sameMinute),
    ]);
    expect(entries[0].proposedFilename).toBe('2026-09-02_1639-my-video.md');
    expect(entries[1].proposedFilename).toBe('2026-09-02_1639-my-video-2.md');
  });

  it('routes a stray .txt transcript file to Transcripts/yt, not a Reference folder', () => {
    const entries = computeManifest([file('10 British Box Office Bombs zSKQl1IBXx4_2026-02-04T12-00-19.txt')]);
    expect(entries[0].isStrayTxt).toBe(true);
    expect(entries[0].proposedFolder).toMatch(/Transcripts\/yt$/);
  });

  it('excludes a non-.md, non-.txt file instead of silently renaming it into a note', () => {
    const entries = computeManifest([
      file('2026-09-02_1639_jacob-collier-cult-of-genius.md'),
      file('screenshot.png'),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries.some(e => e.sourcePath.endsWith('screenshot.png'))).toBe(false);
  });
});

describe('titleFromFilename', () => {
  it('strips a date prefix and de-slugs the remainder', () => {
    expect(titleFromFilename('2026-03-23_DaVinci_Resolve_API_Projects_Timelines.md')).toBe('DaVinci Resolve API Projects Timelines');
  });

  it('strips a date+time prefix separated by underscores without leaking the time into the title', () => {
    expect(titleFromFilename('2026-09-02_1639_jacob-collier-cult-of-genius.md')).toBe('jacob collier cult of genius');
  });
});

describe('applyEntry', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'migrate-youtube-notes-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeEntry(sourcePath: string, proposedFolder: string, proposedFilename: string): ManifestEntry {
    return {
      sourcePath,
      title: 'Test',
      isStrayTxt: false,
      proposedFolder,
      proposedFilename,
      dateSource: 'mtime',
      duplicateClusterId: null,
    };
  }

  it('copies, verifies by hash, then deletes the source only after verification passes', async () => {
    const sourcePath = join(tempDir, 'source-ok.md');
    await fs.writeFile(sourcePath, 'hello world', 'utf-8');
    const targetFolder = join(tempDir, 'target-ok');
    const entry = makeEntry(sourcePath, targetFolder, 'moved.md');

    const result = await applyEntry(entry);

    expect(result.outcome).toBe('moved');
    const targetContent = await fs.readFile(join(targetFolder, 'moved.md'), 'utf-8');
    expect(targetContent).toBe('hello world');
    await expect(fs.access(sourcePath)).rejects.toThrow();
  });

  it('leaves the source in place and marks the entry failed when the copy does not verify', async () => {
    const sourcePath = join(tempDir, 'source-bad.md');
    await fs.writeFile(sourcePath, 'original content', 'utf-8');
    const targetFolder = join(tempDir, 'target-bad');
    const entry = makeEntry(sourcePath, targetFolder, 'moved.md');

    vi.spyOn(fs, 'copyFile').mockImplementation(async (_src, dest) => {
      await fs.writeFile(dest as string, 'corrupted content', 'utf-8');
    });

    const result = await applyEntry(entry);

    expect(result.outcome).toBe('failed');
    expect(result.error).toMatch(/hash mismatch/);
    const sourceStillThere = await fs.readFile(sourcePath, 'utf-8');
    expect(sourceStillThere).toBe('original content');
  });

  it('refuses to overwrite a pre-existing, unrelated file already at the target path', async () => {
    const sourcePath = join(tempDir, 'source-collision.md');
    await fs.writeFile(sourcePath, 'new content', 'utf-8');
    const targetFolder = join(tempDir, 'target-collision');
    await fs.mkdir(targetFolder, { recursive: true });
    const targetPath = join(targetFolder, 'moved.md');
    await fs.writeFile(targetPath, 'pre-existing unrelated content', 'utf-8');
    const entry = makeEntry(sourcePath, targetFolder, 'moved.md');

    const result = await applyEntry(entry);

    expect(result.outcome).toBe('failed');
    expect(result.error).toMatch(/already exists/);
    expect(await fs.readFile(targetPath, 'utf-8')).toBe('pre-existing unrelated content');
    expect(await fs.readFile(sourcePath, 'utf-8')).toBe('new content');
  });
});
