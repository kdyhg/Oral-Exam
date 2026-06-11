import { describe, expect, it } from "vitest";

import { applyHint, areScoresComplete, buildClassProgress, pickRandomQuestionIds } from "./exam-rules";
import type { Exam, Score, Student } from "./types";

describe("pickRandomQuestionIds", () => {
  it("서로 다른 문항 두 개를 고른다", () => {
    const selected = pickRandomQuestionIds(["R1", "R2", "R3"], () => 0);
    expect(selected).toEqual(["R1", "R2"]);
  });

  it("문항이 부족하면 실패한다", () => {
    expect(() => pickRandomQuestionIds(["R1", "R1"])).toThrow();
  });
});

describe("areScoresComplete", () => {
  it("정답 여부와 유창성이 모두 있어야 완료된다", () => {
    const scores: Score[] = [
      { questionId: "S1", correct: "O", fluency: "X" },
      { questionId: "R1", correct: "X", fluency: "O" },
      { questionId: "R2", correct: "O", fluency: "O" },
    ];
    expect(areScoresComplete(scores)).toBe(true);
    expect(areScoresComplete([{ ...scores[0], fluency: null }, ...scores.slice(1)])).toBe(false);
  });
});

describe("applyHint", () => {
  const exam = {
    scores: [
      { questionId: "S1", correct: null, fluency: null },
      { questionId: "R1", correct: null, fluency: null },
      { questionId: "R2", correct: null, fluency: null },
    ],
    hintQuestionId: null,
    hintAt: null,
  } as Exam;

  it("배정 문항에 Hint 1회를 기록한다", () => {
    const result = applyHint(exam, "R1", "2026-06-11T00:00:00.000Z");
    expect(result.hintQuestionId).toBe("R1");
    expect(result.hintAt).toBe("2026-06-11T00:00:00.000Z");
  });

  it("다른 문항에 두 번째 Hint를 쓰지 못한다", () => {
    const used = applyHint(exam, "R1", "2026-06-11T00:00:00.000Z");
    expect(() => applyHint(used, "R2", "2026-06-11T00:01:00.000Z")).toThrow(
      "Hint는 전체 평가에서 한 번만 사용할 수 있습니다.",
    );
  });
});

describe("buildClassProgress", () => {
  it("반별 완료 및 진행 중 인원을 계산한다", () => {
    const students = [
      { studentId: "20101", className: "2-1", number: 1, name: "가", active: true },
      { studentId: "20102", className: "2-1", number: 2, name: "나", active: true },
    ] satisfies Student[];
    const exams = [
      { studentId: "20101", status: "COMPLETED" },
      { studentId: "20102", status: "IN_PROGRESS" },
    ] as Exam[];

    expect(buildClassProgress(students, exams)).toEqual([
      { className: "2-1", total: 2, completed: 1, inProgress: 1 },
    ]);
  });
});
