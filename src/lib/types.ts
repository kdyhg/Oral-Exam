import type { Round } from "./rounds";

export type Difficulty = "HIGH" | "MID" | "LOW";
export type ExamLevel = Difficulty | "OWN";
export type Outcome = "SOLVED" | "FAILED" | "NO_ATTEMPT";
export type ExamStatus = "IN_PROGRESS" | "COMPLETED";

export interface Student {
  studentId: string;
  className: string;
  number: number;
  name: string;
  active: boolean;
}

export interface Question {
  id: string;
  round: Round;
  difficulty: Difficulty;
  title: string;
  prompt: string;
}

export interface Exam {
  examId: string;
  round: Round;
  studentId: string;
  className: string;
  number: number;
  name: string;
  level: ExamLevel;
  firstQuestionId: string | null;
  redrawQuestionId: string | null;
  redrawAt: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: Outcome | null;
  score: number | null;
  memo: string;
  status: ExamStatus;
  updatedAt: string;
  revision: number;
}

export interface ExamDraft {
  exam: Exam;
  baseRevision: number;
  touchedAt: string;
}

export interface ExamSubmission {
  exam: Exam;
  baseRevision: number;
  forceOverwrite: boolean;
}

export interface ExamConflict {
  code: "VERSION_CONFLICT";
  latestExam: Exam | null;
  latestRevision: number;
}

export interface ExamResetResult {
  studentId: string;
  revision: number;
}

export interface AppSettings {
  durationSeconds: number;
  warningSeconds: number;
}

export interface ClassProgress {
  className: string;
  total: number;
  completed: number;
  inProgress: number;
}

export interface BootstrapData {
  round: Round;
  students: Student[];
  questions: Question[];
  exams: Exam[];
  recordRevisions: Record<string, number>;
  settings: AppSettings;
  progress: ClassProgress[];
}

