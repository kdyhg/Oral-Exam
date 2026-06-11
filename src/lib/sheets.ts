import { randomUUID } from "node:crypto";

import { google, type sheets_v4 } from "googleapis";

import { applyHint, areScoresComplete, buildClassProgress, pickRandomQuestionIds } from "@/lib/exam-rules";
import type {
  AppSettings,
  BootstrapData,
  Exam,
  ExamStatus,
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

type ExamPatch = {
  scores?: Score[];
  memo?: string;
  hintQuestionId?: string;
  status?: ExamStatus;
};

type ExamRow = { exam: Exam; rowNumber: number };

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

function parseExam(row: unknown[]): Exam {
  const questionIds = [text(row, 5), text(row, 6), text(row, 7)] as [
    string,
    string,
    string,
  ];
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
      { questionId: questionIds[0], correct: mark(row, 12), fluency: mark(row, 13) },
      { questionId: questionIds[1], correct: mark(row, 14), fluency: mark(row, 15) },
      { questionId: questionIds[2], correct: mark(row, 16), fluency: mark(row, 17) },
    ],
    memo: text(row, 18),
    status: text(row, 19) === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    updatedAt: text(row, 20),
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
    exam.scores[0].fluency ?? "",
    exam.scores[1].correct ?? "",
    exam.scores[1].fluency ?? "",
    exam.scores[2].correct ?? "",
    exam.scores[2].fluency ?? "",
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

async function readExamRows(): Promise<ExamRow[]> {
  const rows = await readRange(`${EXAMS_SHEET}!A2:U`);
  return rows
    .map((row, index) => ({ exam: parseExam(row), rowNumber: index + 2 }))
    .filter(({ exam }) => exam.examId);
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
  const exams = examRows.map(({ exam }) => exam);
  return {
    students,
    questions,
    exams,
    settings,
    progress: buildClassProgress(students, exams),
  };
}

export async function createExam(
  studentId: string,
  selfQuestionId: string,
): Promise<Exam> {
  const [students, questions, examRows] = await Promise.all([
    readStudents(),
    readQuestions(),
    readExamRows(),
  ]);
  const existing = examRows.find(({ exam }) => exam.studentId === studentId)?.exam;
  if (existing) return existing;

  const student = students.find((item) => item.studentId === studentId && item.active);
  if (!student) throw new Error("활성 학생을 찾을 수 없습니다.");

  const selfQuestion = questions.find(
    (question) => question.id === selfQuestionId && question.type === "SELF",
  );
  if (!selfQuestion) throw new Error("올바른 자기선택형 문항을 선택해 주세요.");

  const randomQuestionIds = pickRandomQuestionIds(
    questions.filter((question) => question.type === "RANDOM").map((question) => question.id),
  );
  const now = new Date().toISOString();
  const exam: Exam = {
    examId: randomUUID(),
    studentId: student.studentId,
    className: student.className,
    number: student.number,
    name: student.name,
    selfQuestionId,
    randomQuestionIds,
    startedAt: now,
    endedAt: null,
    hintQuestionId: null,
    hintAt: null,
    scores: [
      { questionId: selfQuestionId, correct: null, fluency: null },
      { questionId: randomQuestionIds[0], correct: null, fluency: null },
      { questionId: randomQuestionIds[1], correct: null, fluency: null },
    ],
    memo: "",
    status: "IN_PROGRESS",
    updatedAt: now,
  };

  const { sheets, spreadsheetId } = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${EXAMS_SHEET}!A:U`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [serializeExam(exam)] },
  });
  return exam;
}

export async function updateExam(examId: string, patch: ExamPatch): Promise<Exam> {
  const examRows = await readExamRows();
  const match = examRows.find(({ exam }) => exam.examId === examId);
  if (!match) throw new Error("평가 기록을 찾을 수 없습니다.");

  const exam = structuredClone(match.exam);
  if (patch.scores) {
    if (
      patch.scores.length !== 3 ||
      patch.scores.some((score, index) => score.questionId !== exam.scores[index].questionId)
    ) {
      throw new Error("배정된 문항과 평가 항목이 일치하지 않습니다.");
    }
    exam.scores = patch.scores as [Score, Score, Score];
  }
  if (typeof patch.memo === "string") exam.memo = patch.memo.slice(0, 1000);
  if (patch.hintQuestionId) {
    Object.assign(exam, applyHint(exam, patch.hintQuestionId, new Date().toISOString()));
  }
  if (patch.status === "COMPLETED") {
    if (!areScoresComplete(exam.scores)) {
      throw new Error("정답 여부와 유창성을 모두 선택해 주세요.");
    }
    exam.status = "COMPLETED";
    exam.endedAt ??= new Date().toISOString();
  }
  exam.updatedAt = new Date().toISOString();

  const { sheets, spreadsheetId } = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${EXAMS_SHEET}!A${match.rowNumber}:U${match.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [serializeExam(exam)] },
  });
  return exam;
}
