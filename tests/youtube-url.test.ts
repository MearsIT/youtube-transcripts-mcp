import { describe, it, expect } from 'vitest';
import { isValidYouTubeUrl, extractVideoId } from '../youtube-downloader.js';

describe('isValidYouTubeUrl', () => {

  describe('YouTube Shorts URLs', () => {
    it('accepts https://www.youtube.com/shorts/<id>', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts https://youtube.com/shorts/<id> (no www)', () => {
      expect(isValidYouTubeUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts http://www.youtube.com/shorts/<id> (http)', () => {
      expect(isValidYouTubeUrl('http://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts Shorts URL with hyphens and underscores in ID', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/a1B2c3D4_-e')).toBe(true);
    });
  });

  describe('standard watch URLs', () => {
    it('accepts https://www.youtube.com/watch?v=<id>', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('accepts URL with additional query parameters', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe(true);
    });
  });

  describe('short URLs (youtu.be)', () => {
    it('accepts https://youtu.be/<id>', () => {
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });
  });

  describe('embed URLs', () => {
    it('accepts https://www.youtube.com/embed/<id>', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    });
  });

  describe('legacy /v/ URLs', () => {
    it('accepts https://www.youtube.com/v/<id>', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      expect(isValidYouTubeUrl('')).toBe(false);
    });

    it('rejects random URL', () => {
      expect(isValidYouTubeUrl('https://example.com/video')).toBe(false);
    });

    it('rejects YouTube URL with too-short ID', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/abc')).toBe(false);
    });

    it('rejects YouTube channel URL', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/channel/UCxxxxxx')).toBe(false);
    });
  });
});

describe('extractVideoId', () => {

  describe('YouTube Shorts URLs', () => {
    it('extracts ID from https://www.youtube.com/shorts/<id>', () => {
      expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from https://youtube.com/shorts/<id> (no www)', () => {
      expect(extractVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from Shorts URL with hyphens and underscores', () => {
      expect(extractVideoId('https://www.youtube.com/shorts/a1B2c3D4_-e')).toBe('a1B2c3D4_-e');
    });
  });

  describe('standard watch URLs', () => {
    it('extracts ID from watch URL', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('short URLs', () => {
    it('extracts ID from youtu.be URL', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('embed URLs', () => {
    it('extracts ID from embed URL', () => {
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('direct video ID', () => {
    it('extracts bare 11-character ID', () => {
      expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(extractVideoId('')).toBeNull();
    });

    it('returns null for non-YouTube URL', () => {
      expect(extractVideoId('https://example.com/video')).toBeNull();
    });

    it('returns null for YouTube URL without valid ID', () => {
      expect(extractVideoId('https://www.youtube.com/channel/UCxxxxxx')).toBeNull();
    });
  });
});
