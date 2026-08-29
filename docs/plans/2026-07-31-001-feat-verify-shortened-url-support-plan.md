# Verify Shortened YouTube URL Support (youtu.be)

**Type:** feat  
**Created:** 2026-07-31  
**Plan Depth:** Lightweight

## Summary

Verify end-to-end functionality of shortened YouTube URLs (youtu.be format) with the MCP server's yt-dlp integration. Unit tests confirm URL parsing works, but no integration test confirms actual caption downloads succeed with youtu.be URLs. Test with real shortened URL `https://youtu.be/gf0AVhA3phc`, verify yt-dlp downloads captions successfully, and document the verified behavior in the test suite.

## Problem Frame

The MCP server's URL validation regex supports `youtu.be/<id>` URLs (line 157 in youtube-downloader.ts), and unit tests confirm `isValidYouTubeUrl()` and `extractVideoId()` handle these correctly. However, all existing integration tests use full `youtube.com/watch?v=` URLs. There's no empirical evidence that yt-dlp successfully downloads captions when given a youtu.be URL, despite the assumption that yt-dlp handles URL normalization internally.

**User need:** Confidence that passing shortened URLs to the MCP server works end-to-end, not just at the URL parsing layer.

**Current gap:** Unit test coverage exists; integration test coverage does not.

---

## Requirements

- **R1:** Verify `https://youtu.be/gf0AVhA3phc` downloads captions successfully through the full pipeline (URL → yt-dlp → VTT file → cleaned text)
- **R2:** Confirm yt-dlp command receives and processes youtu.be URLs correctly
- **R3:** Document the verification in a reusable integration test that covers the youtu.be format explicitly

---

## Key Technical Decisions

**KTD1: Use manual test script first, optionally formalize as automated test later**

Create a standalone verification script following the pattern in `test-simple.js` to confirm youtu.be URLs work end-to-end before deciding whether to add to the automated test suite.

*Rationale:* The research confirms this is a verification task, not a code change. A quick manual test answers the question fastest. If the test reveals issues, we fix them. If it passes, we can optionally add it to the suite for regression protection (see origin: Institutional learning - "Sample actual evidence before accepting claims").

**KTD2: Test with the user's specific URL first, then optionally test a known-working video**

Start with `https://youtu.be/gf0AVhA3phc` (user's request). If that video lacks captions or hits rate limits, fall back to `https://youtu.be/jNQXAC9IVRw` ("Me at the zoo" - known to have captions and less likely to be rate-limited).

*Rationale:* Testing the exact URL the user provided gives immediate feedback. Fallback ensures we can verify behavior even if the specific video is unavailable.

**KTD3: Monitor stderr logs and session folder to observe yt-dlp behavior**

During test execution, check:
- The yt-dlp command logged to stderr (confirm URL passed correctly)
- Session folder creation in `/home/jandal/Documents/Obsidian/METJM/Transcripts/yt/`
- VTT file downloaded
- Cleaned text extracted

*Rationale:* Observing the full pipeline provides evidence of what actually happens, not just whether the final result succeeds or fails (see origin: agent-friendly CLI principles learning).

---

## Implementation Units

### U1. Create verification test script for youtu.be URL

**Goal:** Write a standalone test script that downloads captions from a youtu.be URL and verifies the full pipeline.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- `test-youtu-be.js` (create new)

**Approach:** Follow the pattern from `test-simple.js`: spawn the MCP server, send a `process-youtube-captions` tool call with `https://youtu.be/gf0AVhA3phc`, capture stdout/stderr, parse JSON-RPC responses, verify success.

**Patterns to follow:**
- `test-simple.js` lines 25-70 for server spawn and JSON-RPC communication
- `test-video.js` lines 15-25 for response parsing and success verification

**Test scenarios:**
- **Happy path:** Send youtu.be URL to `process-youtube-captions` tool, verify response contains `isError: false`, verify session folder created, verify VTT and cleaned text files exist
- **yt-dlp command verification:** Check stderr logs contain the expected yt-dlp command with the youtu.be URL
- **File discovery:** Verify the file pattern matching (lines 113-128 in youtube-downloader.ts) finds the downloaded VTT file

**Verification:** 
- Run `node test-youtu-be.js`
- Observe "✓ Caption download successful" message
- Check session folder exists in `/home/jandal/Documents/Obsidian/METJM/Transcripts/yt/` with naming pattern `YYYY-MM-DD_HHmmss_<videoTitle>/`
- Verify VTT file created with pattern `*_gf0AVhA3phc.en*.vtt`
- Verify cleaned text file created

---

### U2. Run verification test and document results

**Goal:** Execute the test script, observe the full pipeline, and record whether youtu.be URLs work as expected.

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- `test-youtu-be.js` (run)
- Session folder in `/home/jandal/Documents/Obsidian/METJM/Transcripts/yt/` (observe)
- Terminal output (observe)

**Approach:** 
1. Build the project: `npm run build`
2. Run the test: `node test-youtu-be.js`
3. Monitor stderr for yt-dlp command execution
4. Check session folder for downloaded files
5. Verify the response indicates success

**Test scenarios:**
- **Success case:** Test completes with no errors, files created, response shows success
- **Fallback case:** If video lacks captions or hits rate limit, modify test to use `https://youtu.be/jNQXAC9IVRw` and re-run
- **Error scenario:** If download fails, examine stderr logs to understand why (missing captions, rate limit, yt-dlp error)

**Verification:**
- Test script exits with code 0
- Session folder contains VTT file and cleaned text
- Console shows "✓ Caption download successful" or similar success indicator
- No unhandled errors in stderr (rate limit warnings are acceptable if yt-dlp still succeeds)

---

### U3. Optionally add youtu.be test case to integration test suite

**Goal:** If verification passes, consider adding a youtu.be test case to the formal test suite for regression protection.

**Requirements:** R3

**Dependencies:** U2 (only proceed if U2 passes)

**Files:**
- `tests/youtube-download.integration.test.ts` (create new, optional)
- `vitest.config.ts` (no changes needed - already configured)

**Approach:** Convert the manual test script into a Vitest integration test following the pattern from `test-simple.js` but wrapped in `describe()` and `it()` blocks. Use a known-working video (`https://youtu.be/jNQXAC9IVRw`) to avoid flakiness from captions availability or rate limits.

**Execution note:** This unit is optional. Only proceed if:
- U2 verification passes successfully
- The user wants regression protection for this behavior
- The team is comfortable with integration tests that call external services (yt-dlp → YouTube)

**Test scenarios:**
- Test expectation: none -- this unit is optional and only executes if the user confirms they want formal test coverage

**Verification:**
- If implemented: `npm test` includes the new integration test and it passes
- Test file follows Vitest conventions (describe/it blocks, expect assertions)
- Test uses a reliable video ID that won't be deleted or lose captions

---

## Scope Boundaries

### In Scope
- Verify shortened URL (`https://youtu.be/gf0AVhA3phc`) downloads captions successfully
- Observe yt-dlp command execution and file creation
- Document the verification in a test script

### Out of Scope
- Changing URL validation logic (already works per unit tests)
- Adding support for other URL formats beyond what's already supported
- Modifying yt-dlp command flags or error handling (current implementation is sufficient)
- Testing all supported URL formats end-to-end (focus is youtu.be only)

### Deferred to Follow-Up Work
- Formal integration test suite for all URL formats (standard watch, embed, shorts, etc.) if team decides integration tests should cover the full URL support matrix
- CI automation of integration tests (currently all integration tests are manual)

---

## Open Questions

**Q1:** Should we add the youtu.be test case to the automated test suite (U3)?

- **Lean:** Skip U3. The manual verification (U2) is sufficient. Integration tests that call external services are brittle.
- **Thorough:** Add U3 for regression protection, but use a reliable test video and accept occasional flakiness from network/rate limit issues.
- **Resolution:** Defer to user preference after U2 completes.

**Q2:** If `gf0AVhA3phc` lacks captions or is rate-limited, should we test with the fallback video?

- **Resolution:** Yes, use `https://youtu.be/jNQXAC9IVRw` as fallback per KTD2.

---

## Risks & Dependencies

**Risk 1: Video may not have captions or may be rate-limited**

*Mitigation:* Use fallback video (`youtu.be/jNQXAC9IVRw`) known to have captions and be less rate-limited.

**Risk 2: yt-dlp may handle youtu.be URLs differently than expected**

*Likelihood:* Low. yt-dlp is designed to normalize all YouTube URL formats.

*Impact:* Medium. If yt-dlp fails with youtu.be URLs, we'd need to normalize URLs before passing to yt-dlp.

*Mitigation:* The verification test (U1-U2) will reveal this immediately. If it occurs, add URL normalization logic in youtube-downloader.ts before the yt-dlp command.

**Dependency:** Requires yt-dlp installed on system (already a documented prerequisite).

---

## Sources & Research

- **Repo research:** youtube-downloader.ts lines 156-159 (URL validation regex includes youtu.be)
- **Repo research:** tests/youtube-url.test.ts (23 unit tests confirm URL parsing works for youtu.be)
- **Repo research:** test-simple.js, test-video.js (integration test patterns to follow)
- **Institutional learning:** "Sample actual evidence before accepting claims" - unit tests aren't sufficient for external tool integration verification
- **Institutional learning:** Agent-friendly CLI principles - verify yt-dlp produces actionable errors and handles timeouts gracefully
