"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { ExamView } from "@/components/exam-view";
import { LoginView } from "@/components/login-view";
import { QuestionChooser } from "@/components/question-chooser";
import { buildClassProgress } from "@/lib/exam-rules";
import type { BootstrapData, Exam, Score, Student } from "@/lib/types";

export function OralExamApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
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

  async function startExam(selfQuestionId: string) {
    if (!selectedStudent) return;
    setBusy(true);
    setError("");
    try {
      const exam = await request<Exam>("/api/exams", {
        method: "POST",
        body: JSON.stringify({ studentId: selectedStudent.studentId, selfQuestionId }),
      });
      replaceExam(exam);
    } catch (startError) {
      setError(message(startError));
    } finally {
      setBusy(false);
    }
  }

  async function patchExam(patch: {
    scores?: Score[];
    memo?: string;
    hintQuestionId?: string;
    status?: "COMPLETED";
  }) {
    const exam = activeExam();
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      replaceExam(
        await request<Exam>(`/api/exams/${exam.examId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      );
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setBusy(false);
    }
  }

  function activeExam(): Exam | undefined {
    return data?.exams.find((exam) => exam.studentId === selectedStudent?.studentId);
  }

  function replaceExam(nextExam: Exam) {
    setData((current) => {
      if (!current) return current;
      const exams = current.exams.some((exam) => exam.examId === nextExam.examId)
        ? current.exams.map((exam) => (exam.examId === nextExam.examId ? nextExam : exam))
        : [...current.exams, nextExam];
      return { ...current, exams, progress: buildClassProgress(current.students, exams) };
    });
  }

  if (authenticated === null) return <main className="loading">평가 데이터를 확인하고 있습니다...</main>;
  if (!authenticated || !data) return <LoginView busy={busy} error={error} onLogin={login} />;

  const exam = activeExam();
  if (selectedStudent && exam) {
    return (
      <ExamView
        key={exam.examId}
        exam={exam}
        questions={data.questions}
        settings={data.settings}
        busy={busy}
        error={error}
        onBack={() => {
          setError("");
          setSelectedStudent(null);
        }}
        onPatch={patchExam}
      />
    );
  }
  if (selectedStudent) {
    return (
      <QuestionChooser
        student={selectedStudent}
        questions={data.questions.filter((question) => question.type === "SELF")}
        busy={busy}
        onBack={() => setSelectedStudent(null)}
        onChoose={startExam}
      />
    );
  }
  return <Dashboard data={data} onSelectStudent={setSelectedStudent} onLogout={logout} />;
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
