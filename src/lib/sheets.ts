import { randomUUID } from "node:crypto";

import { google, type sheets_v4 } from "googleapis";

import { InputError } from "@/lib/api";
import { difficultyFromLabel } from "@/lib/labels";
import { buildClassProgress, examStructureError } from "@/lib/exam-rules";
import {
  hasRevisionConflict,
  nextRevision,
  resetHistoryExam,
  saveType,
  storedEndedAt,
  type SaveType,
} from "@/lib/exam-version";
import { recordSheetName, roundLabel, type Round } from "@/lib/rounds";
import { calculateScore } from "@/lib/scoring";
import {
  HISTORY_SHEET,
  QUESTIONS_SHEET,
  RECORD_COLUMN_COUNT,
  ROSTER_SHEET,
  SETTINGS_SHEET,
  a1,
  blankRecordRow,
  cellText,
  hasRecordHeader,
  historyRow,
  parseRecordRow,
  recordRevision,
  serializeExam,
  type SheetCell,
} from "@/lib/sheet-schema";
import type {
  AppSettings,
  BootstrapData,
  Exam,
  ExamResetResult,
  ExamSubmission,
  Question,
  Student,
} from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = { durationSeconds: 240, warningSeconds: 60 };

type RecordRow = { exam: Exam | null; studentId: string; rowNumber: number; revision: number };

export class ExamConflictError extends Error {
  readonly code = "VERSION_CONFLICT";

  constructor(
    readonly latestExam: Exam | null,
    readonly latestRevision: number,
  ) {
    super("다른 기기에서 이 학생의 평가 기록이 먼저 저장되었습니다.");
  }
}

function requiredEnv(
  name: "GOOGLE_SHEET_ID" | "GOOGLE_SERVICE_ACCOUNT_EMAIL" | "GOOGLE_PRIVATE_KEY",
): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return value;
}

function getClient(): { sheets: sheets_v4.Sheets; spreadsheetId: string } {
  const auth = new google.auth.JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
  };
}

async function readRange(range: string): Promise<unknown[][]> {
  const { sheets, spreadsheetId } = getClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values ?? [];
}

async function readStudents(): Promise<Student[]> {
  const rows = await readRange(a1(ROSTER_SHEET, "A2:E"));
  return rows
    .filter((row) => cellText(row, 0) && cellText(row, 3))
    .map((row) => ({
      studentId: cellText(row, 0),
      className: cellText(row, 1),
      number: Number(row[2]),
      name: cellText(row, 3),
      active: cellText(row, 4).toUpperCase() !== "FALSE",
    }));
}

async function readQuestions(round: Round): Promise<Question[]> {
  const rows = await readRange(a1(QUESTIONS_SHEET, "A2:E"));
  return rows.flatMap((row) => {
    const difficulty = difficultyFromLabel(cellText(row, 2));
    if (!cellText(row, 0) || cellText(row, 1) !== roundLabel(round) || !difficulty) return [];
    return [
      {
        id: cellText(row, 0),
        round,
        difficulty,
        title: cellText(row, 3),
        prompt: cellText(row, 4),
      },
    ];
  });
}

async function readRecordRows(round: Round): Promise<RecordRow[]> {
  const values = await readRange(a1(recordSheetName(round), `A1:${columnLetter(RECORD_COLUMN_COUNT)}`));
  if (!hasRecordHeader(values[0] ?? [])) {
    throw new Error(
      `'${recordSheetName(round)}' Sheet 형식이 올바르지 않습니다. Sheet 설정 도구를 실행해 주세요.`,
    );
  }
  return values
    .slice(1)
    .map((row, index) => ({
      exam: parseRecordRow(row, round),
      studentId: cellText(row, 1),
      rowNumber: index + 2,
      revision: recordRevision(row),
    }))
    .filter(({ studentId }) => studentId);
}

async function readSettings(): Promise<AppSettings> {
  const rows = await readRange(a1(SETTINGS_SHEET, "A2:B"));
  const values = new Map(rows.map((row) => [cellText(row, 0), Number(row[1])]));
  return {
    durationSeconds: values.get("durationSeconds") || DEFAULT_SETTINGS.durationSeconds,
    warningSeconds: values.get("warningSeconds") || DEFAULT_SETTINGS.warningSeconds,
  };
}

export async function getBootstrapData(round: Round): Promise<BootstrapData> {
  const [students, questions, recordRows, settings] = await Promise.all([
    readStudents(),
    readQuestions(round),
    readRecordRows(round),
    readSettings(),
  ]);
  const exams = recordRows.flatMap((row) => (row.exam ? [row.exam] : []));
  return {
    round,
    students,
    questions,
    exams,
    recordRevisions: Object.fromEntries(recordRows.map((row) => [row.studentId, row.revision])),
    settings,
    progress: buildClassProgress(students, exams),
  };
}

export async function submitExam(submission: ExamSubmission): Promise<Exam> {
  const { exam: input, baseRevision, forceOverwrite } = submission;
  const round = input.round;
  const [students, questions, recordRows] = await Promise.all([
    readStudents(),
    readQuestions(round),
    readRecordRows(round),
  ]);

  const student = students.find((item) => item.studentId === input.studentId && item.active);
  if (!student) throw new InputError("활성 학생을 찾을 수 없습니다.");
  const structureError = examStructureError(input, questions);
  if (structureError) throw new InputError(structureError);
  if (!input.outcome) throw new InputError("평가 결과를 선택해 주세요.");

  const fixedRow = recordRows.find((row) => row.studentId === input.studentId);
  if (!fixedRow) {
    throw new Error("학생별 고정 평가 행을 찾을 수 없습니다. Sheet 설정 도구를 다시 실행해 주세요.");
  }
  const existing = fixedRow.exam;
  if (hasRevisionConflict(baseRevision, fixedRow.revision, forceOverwrite)) {
    throw new ExamConflictError(existing, fixedRow.revision);
  }

  const now = new Date().toISOString();
  const exam: Exam = {
    examId: existing?.examId ?? input.examId ?? randomUUID(),
    round,
    studentId: student.studentId,
    className: student.className,
    number: student.number,
    name: student.name,
    level: input.level,
    firstQuestionId: input.firstQuestionId,
    redrawQuestionId: input.redrawQuestionId,
    redrawAt: input.redrawQuestionId ? input.redrawAt : null,
    startedAt: existing?.startedAt ?? validDateOr(input.startedAt, now),
    endedAt: storedEndedAt(existing, now),
    outcome: input.outcome,
    // 점수는 브라우저 값을 믿지 않고 서버에서 평가계획 기준으로 다시 계산합니다.
    score: calculateScore(input.level, Boolean(input.redrawQuestionId), input.outcome),
    memo: input.memo.slice(0, 1000),
    status: "COMPLETED",
    updatedAt: now,
    revision: nextRevision(fixedRow.revision),
  };

  await writeRecordAndHistory(
    round,
    fixedRow.rowNumber,
    serializeExam(exam),
    historyRow(randomUUID(), now, saveType(existing, forceOverwrite), round, serializeExam(exam)),
  );
  return exam;
}

export async function resetExam(
  round: Round,
  studentId: string,
  baseRevision: number,
): Promise<ExamResetResult> {
  const [students, recordRows] = await Promise.all([readStudents(), readRecordRows(round)]);

  const student = students.find((item) => item.studentId === studentId && item.active);
  if (!student) throw new InputError("활성 학생을 찾을 수 없습니다.");

  const fixedRow = recordRows.find((row) => row.studentId === studentId);
  if (!fixedRow) {
    throw new Error("학생별 고정 평가 행을 찾을 수 없습니다. Sheet 설정 도구를 다시 실행해 주세요.");
  }
  if (hasRevisionConflict(baseRevision, fixedRow.revision, false)) {
    throw new ExamConflictError(fixedRow.exam, fixedRow.revision);
  }
  if (!fixedRow.exam || fixedRow.exam.status !== "COMPLETED") {
    throw new InputError("초기화할 완료 평가 기록이 없습니다.");
  }

  const now = new Date().toISOString();
  const historyExam = resetHistoryExam(fixedRow.exam, now);
  await writeRecordAndHistory(
    round,
    fixedRow.rowNumber,
    blankRecordRow(student, historyExam.revision),
    historyRow(randomUUID(), now, "RESET" satisfies SaveType, round, serializeExam(historyExam)),
  );
  return { studentId, revision: historyExam.revision };
}

async function writeRecordAndHistory(
  round: Round,
  rowNumber: number,
  record: SheetCell[],
  history: SheetCell[],
): Promise<void> {
  const { sheets, spreadsheetId } = getClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const ids = new Map(
    metadata.data.sheets?.map((sheet) => [
      sheet.properties?.title ?? "",
      sheet.properties?.sheetId ?? -1,
    ]),
  );
  const recordSheetId = ids.get(recordSheetName(round)) ?? -1;
  const historySheetId = ids.get(HISTORY_SHEET) ?? -1;
  if (recordSheetId < 0 || historySheetId < 0) {
    throw new Error("평가기록 또는 평가이력 Sheet를 찾을 수 없습니다. Sheet 설정 도구를 다시 실행해 주세요.");
  }

  // 기록 행 갱신과 이력 추가를 한 번의 batchUpdate로 묶어 함께 성공하거나 함께 실패하게 합니다.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId: recordSheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: record.length,
            },
            rows: [{ values: record.map(cellData) }],
            fields: "userEnteredValue",
          },
        },
        {
          insertDimension: {
            range: { sheetId: historySheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
            inheritFromBefore: false,
          },
        },
        {
          updateCells: {
            range: {
              sheetId: historySheetId,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: history.length,
            },
            rows: [{ values: history.map(cellData) }],
            fields: "userEnteredValue",
          },
        },
      ],
    },
  });
}

function cellData(value: SheetCell): sheets_v4.Schema$CellData {
  if (typeof value === "number") return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: value } };
}

function columnLetter(count: number): string {
  let value = count;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function validDateOr(value: string, fallback: string): string {
  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

