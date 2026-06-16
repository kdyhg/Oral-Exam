import { describe, expect, it } from "vitest";

import { calculateExamScore } from "./scoring";
import type { Exam } from "./types";

const completedExam = {
  status: "COMPLETED",
  fluency: "O",
  scores: [
    { questionId: "S1", correct: "O" },
    { questionId: "R1", correct: "O" },
    { questionId: "R2", correct: "O" },
  ],
} as Exam;

describe("calculateExamScore", () => {
  it("전체 O이면 100점을 계산한다", () => {
    expect(calculateExamScore(completedExam)).toMatchObject({
      fluencyScore: 30,
      selfScore: 30,
      randomCorrectCount: 2,
      randomScore: 40,
      total: 100,
    });
  });

  it("유창성 X, 선택형 X, 무작위 O 1개를 기준대로 계산한다", () => {
    expect(
      calculateExamScore({
        ...completedExam,
        fluency: "X",
        scores: [
          { questionId: "S1", correct: "X" },
          { questionId: "R1", correct: "O" },
          { questionId: "R2", correct: "X" },
        ],
      }),
    ).toMatchObject({
      fluencyScore: 20,
      selfScore: 20,
      randomCorrectCount: 1,
      randomScore: 30,
      total: 70,
    });
  });

  it("무작위 두 문항이 모두 X이면 무작위 점수는 20점이다", () => {
    expect(
      calculateExamScore({
        ...completedExam,
        scores: [
          { questionId: "S1", correct: "O" },
          { questionId: "R1", correct: "X" },
          { questionId: "R2", correct: "X" },
        ],
      }),
    ).toMatchObject({ randomCorrectCount: 0, randomScore: 20, total: 80 });
  });

  it("완료 전이거나 필수 O/X가 빠지면 점수를 표시하지 않는다", () => {
    expect(calculateExamScore({ ...completedExam, status: "IN_PROGRESS" })).toBeNull();
    expect(
      calculateExamScore({
        ...completedExam,
        scores: [
          { questionId: "S1", correct: null },
          { questionId: "R1", correct: "O" },
          { questionId: "R2", correct: "O" },
        ],
      }),
    ).toBeNull();
    expect(calculateExamScore({ ...completedExam, fluency: null })).toBeNull();
  });
});
