"use client";

import { useEffect, useMemo, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { ExamView } from "@/components/exam-view";
import { LoginView } from "@/components/login-view";
import { QuestionChooser } from "@/components/question-chooser";
import { DRAFT_STORAGE_KEY, mergeExams, parseDrafts, type ExamDrafts } from "@/lib/drafts";
import { buildClassProgress, pickRandomQuestionIds } from "@/lib/exam-rules";
import type { BootstrapData, Exam, Student } from "@/lib/types";

export function OralExamApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [drafts, setDrafts] = useState<ExamDrafts>(readBrowserDrafts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchBootstrap()
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setAuthenticated(Boolean(payload));
      })
      .catch((loadError) => {
        if (!active) return;
        setAuthenticated(false);
        setError(message(loadError));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // The active assessment still works when browser storage is unavailable.
    }
  }, [drafts]);

  const visibleData = useMemo(() => {
    if (!data) return null;
    const exams = mergeExams(data.exams, drafts);
    return { ...data, exams, progress: buildClassProgress(data.students, exams) };
  }, [data, drafts]);

  async function login(pin: string) {
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/login", { method: "POST", body: JSON.stringify({ pin }) });
      const payload = await fetchBootstrap();
      setData(payload);
      setAuthenticated(Boolean(payload));
    } catch (loginError) {
      setError(message(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setSelectedStudent(null);
    setAuthenticated(false);
  }

  function selectStudent(student: Student) {
    const saved = data?.exams.find((exam) => exam.studentId === student.studentId);
    if (saved && !drafts[student.studentId]) {
      setDrafts((current) => ({ ...current, [student.studentId]: structuredClone(saved) }));
    }
    setError("");
    setSelectedStudent(student);
  }

  function startExam(selfQuestionId: string) {
    if (!selectedStudent || !data) return;
    const randomQuestionIds = pickRandomQuestionIds(
      data.questions.filter((question) => question.type === "RANDOM").map((question) => question.id),
    );
    const now = new Date().toISOString();
    const draft: Exam = {
      examId: crypto.randomUUID(),
      studentId: selectedStudent.studentId,
      className: selectedStudent.className,
      number: selectedStudent.number,
      name: selectedStudent.name,
      selfQuestionId,
      randomQuestionIds,
      startedAt: now,
      endedAt: null,
      hintQuestionId: null,
      hintAt: null,
      scores: [
        { questionId: selfQuestionId, correct: null },
        { questionId: randomQuestionIds[0], correct: null },
        { questionId: randomQuestionIds[1], correct: null },
      ],
      fluency: null,
      memo: "",
      status: "IN_PROGRESS",
      updatedAt: now,
    };
    updateDraft(draft);
  }

  function updateDraft(exam: Exam) {
    setDrafts((current) => ({ ...current, [exam.studentId]: exam }));
  }

  async function submitDraft(exam: Exam) {
    setBusy(true);
    setError("");
    try {
      const saved = await request<Exam>("/api/exams", {
        method: "POST",
        body: JSON.stringify(exam),
      });
      setData((current) => {
        if (!current) return current;
        const exams = current.exams.some((item) => item.studentId === saved.studentId)
          ? current.exams.map((item) => (item.studentId === saved.studentId ? saved : item))
          : [...current.exams, saved];
        return { ...current, exams, progress: buildClassProgress(current.students, exams) };
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[saved.studentId];
        return next;
      });
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setBusy(false);
    }
  }

  function activeExam(): Exam | undefined {
    if (!selectedStudent) return undefined;
    return drafts[selectedStudent.studentId] ??
      data?.exams.find((exam) => exam.studentId === selectedStudent.studentId);
  }

  if (authenticated === null) return <main className="loading">평가 데이터를 확인하고 있습니다...</main>;
  if (!authenticated || !visibleData) return <LoginView busy={busy} error={error} onLogin={login} />;

  const exam = activeExam();
  if (selectedStudent && exam) {
    return (
      <ExamView
        key={exam.examId}
        exam={exam}
        questions={visibleData.questions}
        settings={visibleData.settings}
        busy={busy}
        error={error}
        onBack={() => {
          setError("");
          setSelectedStudent(null);
        }}
        onChange={updateDraft}
        onSubmit={submitDraft}
      />
    );
  }
  if (selectedStudent) {
    return (
      <QuestionChooser
        student={selectedStudent}
        questions={visibleData.questions.filter((question) => question.type === "SELF")}
        busy={false}
        onBack={() => setSelectedStudent(null)}
        onChoose={startExam}
      />
    );
  }
  return <Dashboard data={visibleData} onSelectStudent={selectStudent} onLogout={logout} />;
}

async function request<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
  return payload;
}

async function fetchBootstrap(): Promise<BootstrapData | null> {
  const response = await fetch("/api/bootstrap", { cache: "no-store" });
  if (response.status === 401) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "데이터를 불러오지 못했습니다.");
  return payload;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

function readBrowserDrafts(): ExamDrafts {
  if (typeof window === "undefined") return {};
  try {
    return parseDrafts(window.localStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return {};
  }
}
