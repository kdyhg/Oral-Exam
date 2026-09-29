import { LEVEL_LABELS, OUTCOME_LABELS, levelFromLabel, outcomeFromLabel } from "./labels";
import type { Round } from "./rounds";
import type { Exam } from "./types";

export type SheetCell = string | number | boolean;

export const ROSTER_SHEET = "학생명렬";
export const QUESTIONS_SHEET = "문항목록";
export const HISTORY_SHEET = "평가이력";
export const SETTINGS_SHEET = "설정";
export const SCORE_SHEET = "점수현황";
export const STATISTICS_SHEET = "점수통계";

export const RECORD_HEADERS = [
  "examId",
  "studentId",
  "반",
  "번호",
  "이름",
  "난이도",
  "처음문항",
  "다시뽑은문항",
  "다시뽑은시각",
  "시작시각",
  "종료시각",
  "결과",
  "점수",
  "교사메모",
  "상태",
  "수정시각",
  "revision",
];
export const RECORD_COLUMN_COUNT = RECORD_HEADERS.length;
const REVISION_INDEX = RECORD_COLUMN_COUNT - 1;
export const HISTORY_HEADERS = ["saveId", "저장시각", "저장유형", "차수", ...RECORD_HEADERS];

// 시트 이름이 숫자로 시작하므로 A1 표기에서 항상 따옴표로 감쌉니다.
export function a1(sheetName: string, range: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}

export function cellText(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

export function hasRecordHeader(header: unknown[]): boolean {
  return RECORD_HEADERS.every((title, index) => cellText(header, index) === title);
}

export function recordRevision(row: unknown[]): number {
  const value = Number(row[REVISION_INDEX]);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function parseRecordRow(row: unknown[], round: Round): Exam | null {
  if (!cellText(row, 0)) return null;
  const level = levelFromLabel(cellText(row, 5));
  if (!level) return null;
  const scoreText = cellText(row, 12);
  return {
    examId: cellText(row, 0),
    round,
    studentId: cellText(row, 1),
    className: cellText(row, 2),
    number: Number(row[3]),
    name: cellText(row, 4),
    level,
    firstQuestionId: cellText(row, 6) || null,
    redrawQuestionId: cellText(row, 7) || null,
    redrawAt: cellText(row, 8) || null,
    startedAt: cellText(row, 9),
    endedAt: cellText(row, 10) || null,
    outcome: outcomeFromLabel(cellText(row, 11)),
    score: scoreText && Number.isFinite(Number(scoreText)) ? Number(scoreText) : null,
    memo: cellText(row, 13),
    status: cellText(row, 14) === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    updatedAt: cellText(row, 15),
    revision: recordRevision(row),
  };
}

export function serializeExam(exam: Exam): SheetCell[] {
  return [
    exam.examId,
    exam.studentId,
    exam.className,
    exam.number,
    exam.name,
    LEVEL_LABELS[exam.level],
    exam.firstQuestionId ?? "",
    exam.redrawQuestionId ?? "",
    exam.redrawAt ?? "",
    exam.startedAt,
    exam.endedAt ?? "",
    exam.outcome ? OUTCOME_LABELS[exam.outcome] : "",
    exam.score ?? "",
    exam.memo,
    exam.status,
    exam.updatedAt,
    exam.revision,
  ];
}

export function blankRecordRow(
  student: { studentId: string; className: string; number: number; name: string },
  revision: number,
): SheetCell[] {
  return [
    "",
    student.studentId,
    student.className,
    student.number,
    student.name,
    ...Array<string>(RECORD_COLUMN_COUNT - 6).fill(""),
    revision,
  ];
}

export function historyRow(
  saveId: string,
  savedAt: string,
  saveType: string,
  round: Round,
  record: SheetCell[],
): SheetCell[] {
  return [saveId, savedAt, saveType, `${round}차`, ...record];
}

