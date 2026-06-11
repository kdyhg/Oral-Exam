import { describe, expect, it } from "vitest";

import { DRAFT_TTL_MS, isDraftStale, mergeExams, parseDrafts, pruneExpiredDrafts } from "./drafts";
import type { Exam, ExamDraft } from "./types";

const now = Date.parse("2026-06-12T00:00:00.000Z");
const exam = {
  examId: "draft-1",
  studentId: "20101",
  scores: [{}, {}, {}],
  status: "IN_PROGRESS",
  startedAt: "2026-06-11T23:50:00.000Z",
  updatedAt: "2026-06-11T23:55:00.000Z",
  revision: 0,
} as Exam;
const draft: ExamDraft = {
  exam,
  baseRevision: 0,
  touchedAt: "2026-06-11T23:55:00.000Z",
};

describe("parseDrafts", () => {
  it("브라우저에 저장된 학생별 초안을 복구한다", () => {
    expect(parseDrafts(JSON.stringify({ "20101": draft }), now)).toEqual({ "20101": draft });
  });

  it("이전 저장 형식도 새 초안 구조로 옮긴다", () => {
    expect(parseDrafts(JSON.stringify({ "20101": exam }), now)["20101"]).toEqual({
      exam,
      baseRevision: 0,
      touchedAt: exam.updatedAt,
    });
  });

  it("잘못되었거나 24시간이 지난 로컬 저장값은 무시한다", () => {
    expect(parseDrafts("not-json", now)).toEqual({});
    expect(parseDrafts(JSON.stringify({ "20102": draft }), now)).toEqual({});
    const expired = { ...draft, touchedAt: new Date(now - DRAFT_TTL_MS).toISOString() };
    expect(parseDrafts(JSON.stringify({ "20101": expired }), now)).toEqual({});
  });

  it("앱이 열린 상태에서도 24시간이 지난 초안을 정리한다", () => {
    const expired = { ...draft, touchedAt: new Date(now - DRAFT_TTL_MS).toISOString() };
    expect(pruneExpiredDrafts({ "20101": expired }, now)).toEqual({});
    expect(pruneExpiredDrafts({ "20101": draft }, now)).toEqual({ "20101": draft });
  });
});

describe("mergeExams", () => {
  it("로컬 초안이 Sheet에서 읽은 기록보다 우선한다", () => {
    const saved = [{ ...exam, examId: "saved", status: "COMPLETED", revision: 1 }] as Exam[];
    expect(mergeExams(saved, { "20101": draft })[0].examId).toBe("draft-1");
  });

  it("Sheet revision이 달라지면 오래된 초안으로 판정한다", () => {
    expect(isDraftStale(draft, { ...exam, revision: 1 })).toBe(true);
    expect(isDraftStale(draft, { ...exam, revision: 0 })).toBe(false);
  });
});
