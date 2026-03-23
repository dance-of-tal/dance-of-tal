import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkSkillUpdate, checkAllUpdates } from "./sync.js";
import type { SkillLockEntry } from "./skill-lock.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
    mockFetch.mockReset();
});

function makeEntry(overrides: Partial<SkillLockEntry> = {}): SkillLockEntry {
    return {
        source: "github",
        sourceUrl: "https://github.com/acme/frontend-skills",
        skillPath: "skills/code-review",
        skillFolderHash: "abc123",
        installedAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

// -----------------------------------------------------------------------
// checkSkillUpdate
// -----------------------------------------------------------------------
describe("checkSkillUpdate", () => {
    it("detects update when hash differs", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sha: "new-hash-999" }),
        });

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry({ skillFolderHash: "old-hash-111" }),
        );

        expect(result.hasUpdate).toBe(true);
        expect(result.currentHash).toBe("old-hash-111");
        expect(result.remoteHash).toBe("new-hash-999");
        expect(result.error).toBeUndefined();
    });

    it("reports no update when hashes match", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sha: "same-hash" }),
        });

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry({ skillFolderHash: "same-hash" }),
        );

        expect(result.hasUpdate).toBe(false);
        expect(result.currentHash).toBe("same-hash");
        expect(result.remoteHash).toBe("same-hash");
    });

    it("handles directory response (array of items)", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                { name: "SKILL.md", sha: "aaa" },
                { name: "scripts", sha: "bbb" },
            ],
        });

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry({ skillFolderHash: "old" }),
        );

        expect(result.hasUpdate).toBe(true);
        expect(result.remoteHash).toBeTruthy();
        expect(typeof result.remoteHash).toBe("string");
    });

    it("handles API failure gracefully", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry(),
        );

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toBe("Could not fetch remote hash");
    });

    it("handles network error gracefully", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry(),
        );

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toBe("Could not fetch remote hash");
    });

    it("handles invalid sourceUrl", async () => {
        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry({ sourceUrl: "not-a-url" }),
        );

        expect(result.hasUpdate).toBe(false);
        expect(result.error).toBe("Invalid sourceUrl format");
    });

    it("sends GITHUB_TOKEN header when available", async () => {
        process.env.GITHUB_TOKEN = "test-token-123";

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sha: "abc" }),
        });

        await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry(),
        );

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("api.github.com"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer test-token-123",
                }),
            }),
        );

        delete process.env.GITHUB_TOKEN;
    });

    it("does not send Authorization when GITHUB_TOKEN is absent", async () => {
        delete process.env.GITHUB_TOKEN;

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sha: "abc" }),
        });

        await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry(),
        );

        const callHeaders = mockFetch.mock.calls[0][1].headers;
        expect(callHeaders.Authorization).toBeUndefined();
    });

    it("detects update when no local hash exists", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sha: "remote-hash" }),
        });

        const result = await checkSkillUpdate(
            "dance/@acme/frontend-skills/code-review",
            makeEntry({ skillFolderHash: undefined }),
        );

        expect(result.hasUpdate).toBe(true);
        expect(result.currentHash).toBeUndefined();
        expect(result.remoteHash).toBe("remote-hash");
    });
});

// -----------------------------------------------------------------------
// checkAllUpdates
// -----------------------------------------------------------------------
describe("checkAllUpdates", () => {
    it("checks multiple skills in parallel", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ sha: "new-1" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ sha: "same-2" }),
            });

        const results = await checkAllUpdates({
            "dance/@a/repo/s1": makeEntry({ skillFolderHash: "old-1" }),
            "dance/@b/repo/s2": makeEntry({ skillFolderHash: "same-2" }),
        });

        expect(results).toHaveLength(2);

        const updated = results.find(r => r.urn === "dance/@a/repo/s1");
        expect(updated?.hasUpdate).toBe(true);

        const upToDate = results.find(r => r.urn === "dance/@b/repo/s2");
        expect(upToDate?.hasUpdate).toBe(false);
    });

    it("returns empty array for empty skills", async () => {
        const results = await checkAllUpdates({});
        expect(results).toEqual([]);
    });
});
