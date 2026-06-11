export type QuestionType = "SELF" | "RANDOM";
export type Mark = "O" | "X" | null;
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
  type: QuestionType;
  title: string;
  prompt: string;
}

export interface Score {
  questionId: string;
  correct: Mark;
}

export interface Exam {
  examId: string;
  studentId: string;
  className: string;
  number: number;
  name: string;
  selfQuestionId: string;
  randomQuestionIds: [string, string];
  startedAt: string;
  endedAt: string | null;
  hintQuestionId: string | null;
  hintAt: string | null;
  scores: [Score, Score, Score];
  fluency: Mark;
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
  students: Student[];
  questions: Question[];
  exams: Exam[];
  settings: AppSettings;
  progress: ClassProgress[];
}
