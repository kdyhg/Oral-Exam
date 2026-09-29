import { describe, expect, it } from "vitest";

import {
  applyRedraw,
  buildClassProgress,
  canRedraw,
  currentQuestionId,
  examStructureError,
  pickQuestionId,
  questionIdsFor,
  timerStartedAt,
} from "./exam-rules";
import type { Exam, Question, Student } from "./types";

const questions: Question[] = [
  { id: "L1", round: 1, difficulty: "LOW", title: "", prompt: "" },
  { id: "L2", round: 1, difficulty: "LOW", title: "", prompt: "" },
  { id: "L3", round: 1, difficulty: "LOW", title: "", prompt: "" },
  { id: "H1", round: 1, difficulty: "HIGH", title: "", prompt: "" },
];

const exam: Exam = {
  examId: "exam-1",
  round: 1,
  studentId: "20101",
  className: "2-1",
  number: 1,
  name: "학생",
  level: "LOW",
  firstQuestionId: "L2",
  redrawQuestionId: null,
  redrawAt: null,
  startedAt: "2026-10-01T00:00:00.000Z",
  endedAt: null,
  outcome: null,
  score: null,
  memo: "",
  status: "IN_PROGRESS",
  updatedAt: "2026-10-01T00:00:00.000Z",
  revision: 0,
};

describe("문항 추첨", () => {
  it("선택한 난이도의 문항만 후보로 쓴다", () => {
    expect(questionIdsFor(questions, "LOW")).toEqual(["L1", "L2", "L3"]);
    expect(questionIdsFor(questions, "OWN")).toEqual([]);
  });

  it("이미 뽑은 문항은 제외하고 뽑는다", () => {
    for (const value of [0, 0.5, 0.99]) {
      expect(pickQuestionId(["L1", "L2", "L3"], ["L2"], () => value)).not.toBe("L2");
    }
    expect(() => pickQuestionId(["H1"], ["H1"])).toThrow();
  });
});

describe("다시 뽑기", () => {
  it("같은 난이도에서 처음 문항을 뺀 문항으로 한 번 다시 뽑고 타이머를 새로 시작한다", () => {
    const redrawAt = "2026-10-01T00:02:00.000Z";
    const redrawn = applyRedraw({ ...exam, outcome: "FAILED", score: 38 }, questions, redrawAt, () => 0);
    expect(redrawn.redrawQuestionId).toBe("L1");
    expect(currentQuestionId(redrawn)).toBe("L1");
    expect(timerStartedAt(redrawn)).toBe(redrawAt);
    expect(redrawn.outcome).toBeNull();
    expect(canRedraw(redrawn, questions)).toBe(false);
    expect(() => applyRedraw(redrawn, questions, redrawAt)).toThrow();
  });

  it("준비한 문제이거나 다른 문항이 없으면 다시 뽑을 수 없다", () => {
    expect(canRedraw({ ...exam, level: "OWN", firstQuestionId: null }, questions)).toBe(false);
    expect(canRedraw({ ...exam, level: "HIGH", firstQuestionId: "H1" }, questions)).toBe(false);
    expect(canRedraw({ ...exam, status: "COMPLETED" }, questions)).toBe(false);
  });
});

describe("examStructureError", () => {
  it("정상 기록은 통과시킨다", () => {
    expect(examStructureError({ ...exam, outcome: "SOLVED" }, questions)).toBeNull();
    expect(
      examStructureError(
        { ...exam, redrawQuestionId: "L3", redrawAt: "2026-10-01T00:02:00.000Z", outcome: "SOLVED" },
        questions,
      ),
    ).toBeNull();
    expect(
      examStructureError({ ...exam, level: "OWN", firstQuestionId: null, outcome: "SOLVED" }, questions),
    ).toBeNull();
  });

  it("결과 누락, 다른 난이도 문항, 같은 문항 재추첨을 거부한다", () => {
    expect(examStructureError(exam, questions)).not.toBeNull();
    expect(examStructureError({ ...exam, firstQuestionId: "H1", outcome: "SOLVED" }, questions)).not.toBeNull();
    expect(
      examStructureError(
        { ...exam, redrawQuestionId: "L2", redrawAt: "2026-10-01T00:02:00.000Z", outcome: "SOLVED" },
        questions,
      ),
    ).not.toBeNull();
    expect(
      examStructureError({ ...exam, redrawQuestionId: "L3", redrawAt: null, outcome: "SOLVED" }, questions),
    ).not.toBeNull();
  });
});

describe("buildClassProgress", () => {
  it("활성 학생만 반별 완료 및 진행 중 인원에 센다", () => {
    const students = [
      { studentId: "20101", className: "2-1", number: 1, name: "가", active: true },
      { studentId: "20102", className: "2-1", number: 2, name: "나", active: true },
      { studentId: "20103", className: "2-1", number: 3, name: "다", active: false },
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

