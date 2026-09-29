import { describe, expect, it } from "vitest";

import { a1, blankRecordRow, parseRecordRow, RECORD_COLUMN_COUNT, serializeExam } from "./sheet-schema";
import type { Exam } from "./types";

describe("평가기록 행 변환", () => {
  it("저장한 행을 다시 읽으면 같은 기록이 된다", () => {
    const exam: Exam = {
      examId: "exam-1",
      round: 1,
      studentId: "20101",
      className: "2-1",
      number: 1,
      name: "학생",
      level: "HIGH",
      firstQuestionId: "1-H1",
      redrawQuestionId: "1-H3",
      redrawAt: "2026-10-01T00:02:00.000Z",
      startedAt: "2026-10-01T00:00:00.000Z",
      endedAt: "2026-10-01T00:05:00.000Z",
      outcome: "SOLVED",
      score: 47,
      memo: "메모",
      status: "COMPLETED",
      updatedAt: "2026-10-01T00:05:00.000Z",
      revision: 2,
    };
    const row = serializeExam(exam);
    expect(row).toHaveLength(RECORD_COLUMN_COUNT);
    expect(row[5]).toBe("상");
    expect(row[11]).toBe("해결");
    expect(parseRecordRow(row, 1)).toEqual(exam);
  });

  it("초기화 행은 학생 정보와 revision만 남긴다", () => {
    const row = blankRecordRow({ studentId: "20101", className: "2-1", number: 1, name: "학생" }, 4);
    expect(row).toHaveLength(RECORD_COLUMN_COUNT);
    expect(row[RECORD_COLUMN_COUNT - 1]).toBe(4);
    expect(parseRecordRow(row, 1)).toBeNull();
  });

  it("숫자로 시작하는 시트 이름을 따옴표로 감싼다", () => {
    expect(a1("1차_평가기록", "A1:Q")).toBe("'1차_평가기록'!A1:Q");
  });
});

