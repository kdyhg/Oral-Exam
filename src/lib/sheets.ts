import { randomUUID } from "node:crypto";

import { google, type sheets_v4 } from "googleapis";

import { areScoresComplete, buildClassProgress, deriveStudentFluency, isMark } from "@/lib/exam-rules";
import type {
  AppSettings,
  BootstrapData,
  Exam,
  Mark,
  Question,
  Score,
  Student,
} from "@/lib/types";

const ROSTER_SHEET = "학생명렬";
const QUESTIONS_SHEET = "문항목록";
const EXAMS_SHEET = "평가기록";
const SETTINGS_SHEET = "설정";
const DEFAULT_SETTINGS: AppSettings = { durationSeconds: 360, warningSeconds: 60 };

type ExamRow = { exam: Exam; rowNumber: number };
type ExamSheetSchema = "legacy" | "current";

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

function parseExam(row: unknown[], schema: ExamSheetSchema): Exam {
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
  };
}

function serializeExam(exam: Exam, schema: ExamSheetSchema): (string | number)[] {
  if (schema === "legacy") {
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
      exam.fluency ?? "",
      exam.scores[1].correct ?? "",
      exam.fluency ?? "",
      exam.scores[2].correct ?? "",
      exam.fluency ?? "",
      exam.memo,
      exam.status,
      exam.updatedAt,
    ];
  }
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
  const schema: ExamSheetSchema = text(values[0] ?? [], 13).includes("유창성")
    ? "legacy"
    : "current";
  return {
    schema,
    rows: values
      .slice(1)
      .map((row, index) => ({ exam: parseExam(row, schema), rowNumber: index + 2 }))
      .filter(({ exam }) => exam.examId),
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
  const exams = examRows.rows.map(({ exam }) => exam);
  return {
    students,
    questions,
    exams,
    settings,
    progress: buildClassProgress(students, exams),
  };
}

export async function submitExam(input: Exam): Promise<Exam> {
  const [students, questions, examRows] = await Promise.all([
    readStudents(),
    readQuestions(),
    readExamRows(),
  ]);
  const student = students.find((item) => item.studentId === input.studentId && item.active);
  if (!student) throw new Error("활성 학생을 찾을 수 없습니다.");

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

  const existing = examRows.rows.find(({ exam }) => exam.studentId === input.studentId);
  const now = new Date().toISOString();
  const exam: Exam = {
    examId: existing?.exam.examId ?? randomUUID(),
    studentId: student.studentId,
    className: student.className,
    number: student.number,
    name: student.name,
    selfQuestionId: input.selfQuestionId,
    randomQuestionIds: input.randomQuestionIds,
    startedAt: Number.isNaN(Date.parse(input.startedAt)) ? now : input.startedAt,
    endedAt: now,
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
  };

  const { sheets, spreadsheetId } = getClient();
  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${EXAMS_SHEET}!A${existing.rowNumber}:${examRows.schema === "legacy" ? "U" : "S"}${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [serializeExam(exam, examRows.schema)] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${EXAMS_SHEET}!A:${examRows.schema === "legacy" ? "U" : "S"}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [serializeExam(exam, examRows.schema)] },
    });
  }
  return exam;
}
