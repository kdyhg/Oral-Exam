import { describe, expect, it } from "vitest";

import {
  hasRevisionConflict,
  nextRevision,
  resetHistoryExam,
  saveType,
  storedEndedAt,
} from "./exam-version";
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

  it("preserves the prior result in RESET history and advances its revision", () => {
    const existing = { examId: "exam-1", updatedAt: "2026-10-01T01:00:00.000Z", revision: 3 } as Exam;
    const reset = resetHistoryExam(existing, "2026-10-02T01:00:00.000Z");
    expect(reset.examId).toBe(existing.examId);
    expect(reset.updatedAt).toBe("2026-10-02T01:00:00.000Z");
    expect(reset.revision).toBe(4);
  });

  it("sets endedAt once and preserves it on later edits", () => {
    const firstCompletedAt = "2026-10-01T01:00:00.000Z";
    expect(storedEndedAt(null, firstCompletedAt)).toBe(firstCompletedAt);
    expect(storedEndedAt({ endedAt: firstCompletedAt } as Exam, "2026-10-01T02:00:00.000Z")).toBe(
      firstCompletedAt,
    );
  });
});

