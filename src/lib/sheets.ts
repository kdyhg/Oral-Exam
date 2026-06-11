import { randomUUID } from "node:crypto";

import { google, type sheets_v4 } from "googleapis";

import { areScoresComplete, buildClassProgress, deriveStudentFluency, isMark } from "@/lib/exam-rules";
import { hasRevisionConflict, nextRevision, saveType, storedEndedAt } from "@/lib/exam-version";
import type {
  AppSettings,
  BootstrapData,
  Exam,
  ExamSubmission,
  Mark,
  Question,
  Score,
  Student,
} from "@/lib/types";

const ROSTER_SHEET = "학생명렬";
const QUESTIONS_SHEET = "문항목록";
const EXAMS_SHEET = "평가기록";
const HISTORY_SHEET = "평가이력";
const SETTINGS_SHEET = "설정";
const DEFAULT_SETTINGS: AppSettings = { durationSeconds: 360, warningSeconds: 60 };

type ExamRow = { exam: Exam | null; studentId: string; rowNumber: number };
type ExamSheetSchema = "legacy" | "current" | "versioned";

export class ExamConflictError extends Error {
  readonly code = "VERSION_CONFLICT";

  constructor(readonly latestExam: Exam | null) {
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

function text(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

function mark(row: unknown[], index: number): Mark {
  const value = text(row, index);
  return value === "O" || value === "X" ? value : null;
}

function revision(row: unknown[], schema: ExamSheetSchema): number {
  if (schema !== "versioned") return text(row, 0) ? 1 : 0;
  const value = Number(row[19]);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseExam(row: unknown[], schema: ExamSheetSchema): Exam | null {
  if (!text(row, 0)) return null;
  const questionIds = [text(row, 5), text(row, 6), text(row, 7)] as [
    string,
    string,
    string,
  ];
  const legacy = schema === "legacy";
  return {
    examId: text(row, 0),
    studentId: text(row, 1),
    className: text(row, 2),
    number: Number(row[3]),
    name: text(row, 4),
    selfQuestionId: questionIds[0],
    randomQuestionIds: [questionIds[1], questionIds[2]],
    startedAt: text(row, 8),
    endedAt: text(row, 9) || null,
    hintQuestionId: text(row, 10) || null,
    hintAt: text(row, 11) || null,
    scores: [
      { questionId: questionIds[0], correct: mark(row, 12) },
      { questionId: questionIds[1], correct: mark(row, legacy ? 14 : 13) },
      { questionId: questionIds[2], correct: mark(row, legacy ? 16 : 14) },
    ],
    fluency: legacy
      ? deriveStudentFluency([mark(row, 13), mark(row, 15), mark(row, 17)])
      : mark(row, 15),
    memo: text(row, legacy ? 18 : 16),
    status: text(row, legacy ? 19 : 17) === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    updatedAt: text(row, legacy ? 20 : 18),
    revision: revision(row, schema),
  };
}

function serializeExam(exam: Exam): (string | number)[] {
  return [
    exam.examId,
    exam.studentId,
    exam.className,
    exam.number,
    exam.name,
    exam.selfQuestionId,
    exam.randomQuestionIds[0],
    exam.randomQuestionIds[1],
    exam.startedAt,
    exam.endedAt ?? "",
    exam.hintQuestionId ?? "",
    exam.hintAt ?? "",
    exam.scores[0].correct ?? "",
    exam.scores[1].correct ?? "",
    exam.scores[2].correct ?? "",
    exam.fluency ?? "",
    exam.memo,
    exam.status,
    exam.updatedAt,
    exam.revision,
  ];
}

async function readRange(range: string): Promise<unknown[][]> {
  const { sheets, spreadsheetId } = getClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values ?? [];
}

async function readStudents(): Promise<Student[]> {
  const rows = await readRange(`${ROSTER_SHEET}!A2:E`);
  return rows
    .filter((row) => text(row, 0) && text(row, 3))
    .map((row) => ({
      studentId: text(row, 0),
      className: text(row, 1),
      number: Number(row[2]),
      name: text(row, 3),
      active: text(row, 4).toUpperCase() !== "FALSE",
    }));
}

async function readQuestions(): Promise<Question[]> {
  const rows = await readRange(`${QUESTIONS_SHEET}!A2:D`);
  return rows
    .filter((row) => text(row, 0))
    .map((row) => ({
      id: text(row, 0),
      type: text(row, 1) === "SELF" ? "SELF" : "RANDOM",
      title: text(row, 2),
      prompt: text(row, 3),
    }));
}

async function readExamRows(): Promise<{ rows: ExamRow[]; schema: ExamSheetSchema }> {
  const values = await readRange(`${EXAMS_SHEET}!A1:U`);
  const header = values[0] ?? [];
  const schema: ExamSheetSchema =
    text(header, 19) === "revision"
      ? "versioned"
      : text(header, 13).includes("유창성")
        ? "legacy"
        : "current";
  return {
    schema,
    rows: values
      .slice(1)
      .map((row, index) => ({
        exam: parseExam(row, schema),
        studentId: text(row, 1),
        rowNumber: index + 2,
      }))
      .filter(({ studentId }) => studentId),
  };
}

async function readSettings(): Promise<AppSettings> {
  const rows = await readRange(`${SETTINGS_SHEET}!A2:B`);
  const values = new Map(rows.map((row) => [text(row, 0), Number(row[1])]));
  return {
    durationSeconds: values.get("durationSeconds") || DEFAULT_SETTINGS.durationSeconds,
    warningSeconds: values.get("warningSeconds") || DEFAULT_SETTINGS.warningSeconds,
  };
}

export async function getBootstrapData(): Promise<BootstrapData> {
  const [students, questions, examRows, settings] = await Promise.all([
    readStudents(),
    readQuestions(),
    readExamRows(),
    readSettings(),
  ]);
  const exams = latestExams(examRows.rows);
  return {
    students,
    questions,
    exams,
    settings,
    progress: buildClassProgress(students, exams),
  };
}

export async function submitExam(submission: ExamSubmission): Promise<Exam> {
  const { exam: input, baseRevision, forceOverwrite } = submission;
  const [students, questions, examRows] = await Promise.all([
    readStudents(),
    readQuestions(),
    readExamRows(),
  ]);
  if (examRows.schema !== "versioned") {
    throw new Error("평가기록 Sheet를 최신 형식으로 마이그레이션한 뒤 저장해 주세요.");
  }

  const student = students.find((item) => item.studentId === input.studentId && item.active);
  if (!student) throw new Error("활성 학생을 찾을 수 없습니다.");
  validateExam(input, questions);

  const fixedRow = examRows.rows.find((row) => row.studentId === input.studentId);
  if (!fixedRow) {
    throw new Error("학생별 고정 평가 행을 찾을 수 없습니다. Sheet 설정 도구를 다시 실행해 주세요.");
  }
  const existing = fixedRow.exam;
  const currentRevision = existing?.revision ?? 0;
  if (hasRevisionConflict(baseRevision, currentRevision, forceOverwrite)) {
    throw new ExamConflictError(existing);
  }

  const now = new Date().toISOString();
  const exam: Exam = {
    examId: existing?.examId ?? input.examId ?? randomUUID(),
    studentId: student.studentId,
    className: student.className,
    number: student.number,
    name: student.name,
    selfQuestionId: input.selfQuestionId,
    randomQuestionIds: input.randomQuestionIds,
    startedAt: existing?.startedAt ?? validDateOr(input.startedAt, now),
    endedAt: storedEndedAt(existing, now),
    hintQuestionId: input.hintQuestionId,
    hintAt: input.hintQuestionId && input.hintAt ? input.hintAt : null,
    scores: input.scores.map((score) => ({
      questionId: score.questionId,
      correct: isMark(score.correct) ? score.correct : null,
    })) as [Score, Score, Score],
    fluency: input.fluency,
    memo: input.memo.slice(0, 1000),
    status: "COMPLETED",
    updatedAt: now,
    revision: nextRevision(currentRevision),
  };

  await writeExamAndHistory(fixedRow.rowNumber, exam, saveType(existing, forceOverwrite));
  return exam;
}

function validateExam(input: Exam, questions: Question[]): void {
  const selfQuestion = questions.find(
    (question) => question.id === input.selfQuestionId && question.type === "SELF",
  );
  if (!selfQuestion) throw new Error("올바른 자기선택형 문항을 선택해 주세요.");

  const randomIds = new Set(
    questions.filter((question) => question.type === "RANDOM").map((question) => question.id),
  );
  if (
    input.randomQuestionIds[0] === input.randomQuestionIds[1] ||
    !input.randomQuestionIds.every((id) => randomIds.has(id))
  ) {
    throw new Error("무작위형 문항 배정을 확인해 주세요.");
  }
  const assignedIds = [
    input.selfQuestionId,
    input.randomQuestionIds[0],
    input.randomQuestionIds[1],
  ];
  if (
    input.scores.length !== 3 ||
    input.scores.some((score, index) => score.questionId !== assignedIds[index]) ||
    !areScoresComplete(input.scores, input.fluency)
  ) {
    throw new Error("정답 여부 3개와 학생별 유창성을 모두 선택해 주세요.");
  }
  if (input.hintQuestionId && !assignedIds.includes(input.hintQuestionId)) {
    throw new Error("배정된 문항에만 Hint를 사용할 수 있습니다.");
  }
}

async function writeExamAndHistory(
  rowNumber: number,
  exam: Exam,
  historyType: ReturnType<typeof saveType>,
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
  const examSheetId = ids.get(EXAMS_SHEET);
  const historySheetId = ids.get(HISTORY_SHEET);
  if (examSheetId === undefined || examSheetId < 0 || historySheetId === undefined || historySheetId < 0) {
    throw new Error("평가기록 또는 평가이력 Sheet를 찾을 수 없습니다. Sheet 설정 도구를 다시 실행해 주세요.");
  }

  const history = [randomUUID(), exam.updatedAt, historyType, ...serializeExam(exam)];
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId: examSheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: 20,
            },
            rows: [{ values: serializeExam(exam).map(cellData) }],
            fields: "userEnteredValue",
          },
        },
        {
          appendCells: {
            sheetId: historySheetId,
            rows: [{ values: history.map(cellData) }],
            fields: "userEnteredValue",
          },
        },
      ],
    },
  });
}

function latestExams(rows: ExamRow[]): Exam[] {
  const latest = new Map<string, Exam>();
  for (const row of rows) {
    if (!row.exam) continue;
    const current = latest.get(row.exam.studentId);
    if (
      !current ||
      row.exam.revision > current.revision ||
      (row.exam.revision === current.revision && row.exam.updatedAt > current.updatedAt)
    ) {
      latest.set(row.exam.studentId, row.exam);
    }
  }
  return [...latest.values()];
}

function cellData(value: string | number): sheets_v4.Schema$CellData {
  return {
    userEnteredValue:
      typeof value === "number" ? { numberValue: value } : { stringValue: value },
  };
}

function validDateOr(value: string, fallback: string): string {
  return Number.isNaN(Date.parse(value)) ? fallback : value;
}
