export declare const VAULT_ROOT = "/home/jandal/Documents/Obsidian/METJM";
export declare const MEDIA_YOUTUBE_DIR: string;
export declare const REFERENCE_YOUTUBE_DIR: string;
export declare const TRANSCRIPTS_YT_DIR: string;
export declare const REPORT_PATH: string;
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
export declare function normalizeTitleWords(title: string): Set<string>;
/** Jaccard similarity on significant words; two entries are a duplicate cluster at >=0.25 with >=2 shared words. */
export declare function titlesAreDuplicates(a: Set<string>, b: Set<string>): boolean;
/** Conservative topic match against existing Reference/<Topic>/ subfolders only; null means no clear match. */
export declare function matchSubtopic(title: string): string | null;
/** Extract a leading YYYY-MM-DD(_HHMM)? date prefix from a filename, when present and parseable. */
export declare function parseFilenameDatePrefix(filename: string): Date | null;
/** Extract the `created:` frontmatter date, when present and parseable (format YYYY-MM-DD-HH:MM). */
export declare function parseFrontmatterCreatedDate(content: string): Date | null;
/** Derive a display title from a filename (strips date prefix/extension, de-slugs). */
export declare function titleFromFilename(filename: string): string;
/** Resolve a target path against already-used paths, appending a disambiguating suffix on collision. */
export declare function resolveCollisionPath(targetPath: string, usedPaths: Set<string>): string;
/**
 * Build the manifest from already-read file info. Pure function (no fs access)
 * so it is unit-testable against synthetic RawFileInfo without a real vault.
 */
export declare function computeManifest(files: RawFileInfo[]): ManifestEntry[];
export declare function buildManifestFromVault(): Promise<ManifestEntry[]>;
export interface MigrationLogEntry extends ManifestEntry {
    outcome: 'moved' | 'failed';
    error?: string;
}
/**
 * Copy-verify-delete a single entry (KTD4): never deletes the source until the copy is proven
 * identical. COPYFILE_EXCL makes the copy itself fail (EEXIST) if an unrelated file already sits
 * at the target path, rather than silently overwriting it -- collision detection during manifest
 * generation only tracks paths proposed within the same run, never pre-existing files on disk.
 */
export declare function applyEntry(entry: ManifestEntry): Promise<MigrationLogEntry>;
//# sourceMappingURL=migrate-youtube-notes.d.ts.map