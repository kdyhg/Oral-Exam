import { describe, expect, it } from "vitest";

import { hasRevisionConflict, nextRevision, saveType, storedEndedAt } from "./exam-version";
import type { Exam } from "./types";

describe("revision concurrency rules", () => {
  it("blocks a stale save unless the teacher explicitly forces it", () => {
    expect(hasRevisionConflict(2, 3, false)).toBe(true);
    expect(hasRevisionConflict(2, 3, true)).toBe(false);
    expect(hasRevisionConflict(3, 3, false)).toBe(false);
  });

  it("increments the current Sheet revision", () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(7)).toBe(8);
  });

  it("classifies every successful save for history", () => {
    expect(saveType(null, false)).toBe("CREATE");
    expect(saveType({} as Exam, false)).toBe("UPDATE");
    expect(saveType({} as Exam, true)).toBe("FORCE_OVERWRITE");
  });
});

describe("completed exam timestamps", () => {
  it("sets endedAt once and preserves it on later edits", () => {
    const firstCompletedAt = "2026-06-12T01:00:00.000Z";
    expect(storedEndedAt(null, firstCompletedAt)).toBe(firstCompletedAt);
    expect(
      storedEndedAt({ endedAt: firstCompletedAt } as Exam, "2026-06-12T02:00:00.000Z"),
    ).toBe(firstCompletedAt);
  });
});
