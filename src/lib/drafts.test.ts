import { describe, expect, it } from "vitest";

import {
  DRAFT_TTL_MS,
  draftStorageKey,
  isDraftStale,
  mergeExams,
  parseDrafts,
  pruneExpiredDrafts,
} from "./drafts";
import type { Exam, ExamDraft } from "./types";

const now = Date.parse("2026-10-01T00:00:00.000Z");
const exam = {
  examId: "draft-1",
  round: 1,
  studentId: "20101",
  level: "MID",
  status: "IN_PROGRESS",
  startedAt: "2026-09-30T23:50:00.000Z",
  updatedAt: "2026-09-30T23:55:00.000Z",
  revision: 0,
} as Exam;
const draft: ExamDraft = { exam, baseRevision: 0, touchedAt: "2026-09-30T23:55:00.000Z" };

describe("parseDrafts", () => {
  it("브라우저에 저장된 학생별 초안을 복구한다", () => {
    expect(parseDrafts(JSON.stringify({ "20101": draft }), 1, now)).toEqual({ "20101": draft });
  });

  it("차수별로 다른 저장 키를 쓰고 다른 차수의 초안은 무시한다", () => {
    expect(draftStorageKey(1)).not.toBe(draftStorageKey(2));
    expect(parseDrafts(JSON.stringify({ "20101": draft }), 2, now)).toEqual({});
  });

  it("잘못되었거나 24시간이 지난 로컬 저장값은 무시한다", () => {
    expect(parseDrafts("not-json", 1, now)).toEqual({});
    expect(parseDrafts(JSON.stringify({ "20102": draft }), 1, now)).toEqual({});
    const expired = { ...draft, touchedAt: new Date(now - DRAFT_TTL_MS).toISOString() };
    expect(parseDrafts(JSON.stringify({ "20101": expired }), 1, now)).toEqual({});
    expect(pruneExpiredDrafts({ "20101": expired }, now)).toEqual({});
  });
});

describe("mergeExams", () => {
  it("로컬 초안이 Sheet에서 읽은 기록보다 우선한다", () => {
    const saved = [{ ...exam, examId: "saved", status: "COMPLETED", revision: 1 }] as Exam[];
    expect(mergeExams(saved, { "20101": draft })[0].examId).toBe("draft-1");
  });

  it("Sheet revision이 달라지면 오래된 초안으로 판정한다", () => {
    expect(isDraftStale(draft, 1)).toBe(true);
    expect(isDraftStale(draft, 0)).toBe(false);
  });
});

