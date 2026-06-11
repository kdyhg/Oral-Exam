import { describe, expect, it } from "vitest";

import { mergeExams, parseDrafts } from "./drafts";
import type { Exam } from "./types";

const draft = {
  examId: "draft-1",
  studentId: "20101",
  scores: [{}, {}, {}],
  status: "IN_PROGRESS",
} as Exam;

describe("parseDrafts", () => {
  it("브라우저에 저장된 학생별 초안을 복구한다", () => {
    expect(parseDrafts(JSON.stringify({ "20101": draft }))).toEqual({ "20101": draft });
  });

  it("잘못된 로컬 저장값은 무시한다", () => {
    expect(parseDrafts("not-json")).toEqual({});
    expect(parseDrafts(JSON.stringify({ "20102": draft }))).toEqual({});
  });
});

describe("mergeExams", () => {
  it("로컬 초안이 Sheet에서 읽은 기록보다 우선한다", () => {
    const saved = [{ ...draft, examId: "saved", status: "COMPLETED" }] as Exam[];
    expect(mergeExams(saved, { "20101": draft })[0].examId).toBe("draft-1");
  });
});
