"use client";

import { useEffect, useMemo, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { ExamView } from "@/components/exam-view";
import { LoginView } from "@/components/login-view";
import { QuestionChooser } from "@/components/question-chooser";
import {
  DRAFT_STORAGE_KEY,
  LEGACY_DRAFT_STORAGE_KEY,
  isDraftStale,
  mergeExams,
  parseDrafts,
  pruneExpiredDrafts,
  type ExamDrafts,
} from "@/lib/drafts";
import { buildClassProgress, pickRandomQuestionIds } from "@/lib/exam-rules";
import type { BootstrapData, Exam, ExamConflict, ExamDraft, Student } from "@/lib/types";

export function OralExamApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [drafts, setDrafts] = useState<ExamDrafts>(readBrowserDrafts);
  const [conflict, setConflict] = useState<ExamConflict | null>(null);
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
      window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
      if (Object.keys(drafts).length) {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
      } else {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // The active assessment still works when browser storage is unavailable.
    }
  }, [drafts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDrafts((current) => pruneExpiredDrafts(current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authenticated || selectedStudent) return;
    let active = true;
    const refresh = () => {
      void fetchBootstrap()
        .then((payload) => {
          if (active && payload) setData(payload);
        })
        .catch(() => {
          // Keep the current dashboard visible when a background refresh fails.
        });
    };
    const timer = window.setInterval(refresh, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authenticated, selectedStudent]);

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
    setConflict(null);
    setAuthenticated(false);
  }

  function selectStudent(student: Student) {
    setError("");
    setConflict(null);
    setSelectedStudent(student);
  }

  function startExam(selfQuestionId: string) {
    if (!selectedStudent || !data) return;
    const randomQuestionIds = pickRandomQuestionIds(
      data.questions.filter((question) => question.type === "RANDOM").map((question) => question.id),
    );
    const now = new Date().toISOString();
    const exam: Exam = {
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
      revision: 0,
    };
    setDrafts((current) => ({
      ...current,
      [exam.studentId]: { exam, baseRevision: 0, touchedAt: now },
    }));
  }

  function updateDraft(exam: Exam) {
    const now = new Date().toISOString();
    const saved = data?.exams.find((item) => item.studentId === exam.studentId);
    setDrafts((current) => ({
      ...current,
      [exam.studentId]: {
        exam,
        baseRevision: current[exam.studentId]?.baseRevision ?? saved?.revision ?? 0,
        touchedAt: now,
      },
    }));
    setConflict(null);
  }

  async function submitDraft(exam: Exam, forceOverwrite = false) {
    const draft = drafts[exam.studentId];
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const saved = await request<Exam>("/api/exams", {
        method: "POST",
        body: JSON.stringify({
          exam,
          baseRevision: draft.baseRevision,
          forceOverwrite,
        }),
      });
      replaceSavedExam(saved);
      removeDraft(saved.studentId);
      setConflict(null);
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && saveError.code === "VERSION_CONFLICT") {
        setConflict({ code: "VERSION_CONFLICT", latestExam: saveError.latestExam });
      }
      setError(message(saveError));
    } finally {
      setBusy(false);
    }
  }

  function discardActiveDraft() {
    if (!selectedStudent) return;
    const draft = drafts[selectedStudent.studentId];
    if (!draft) return;
    const saved = data?.exams.find((exam) => exam.studentId === selectedStudent.studentId);
    const prompt = saved
      ? "저장하지 않은 수정 내용을 버리시겠습니까? Google Sheet의 완료 기록은 유지됩니다."
      : "이 평가를 취소하시겠습니까? 이 기기에 저장된 진행 내용이 삭제됩니다.";
    if (!window.confirm(prompt)) return;
    removeDraft(selectedStudent.studentId);
    setConflict(null);
    setError("");
    setSelectedStudent(null);
  }

  function clearAllDrafts() {
    const count = Object.keys(drafts).length;
    if (!count || !window.confirm(`이 기기에 저장된 초안 ${count}개를 모두 삭제하시겠습니까?`)) return;
    setDrafts({});
    setConflict(null);
    setError("");
  }

  function acceptLatestRecord(latestExam: Exam | null) {
    if (latestExam) replaceSavedExam(latestExam);
    if (selectedStudent) removeDraft(selectedStudent.studentId);
    setConflict(null);
    setError("");
  }

  function replaceSavedExam(saved: Exam) {
    setData((current) => {
      if (!current) return current;
      const exams = current.exams.some((item) => item.studentId === saved.studentId)
        ? current.exams.map((item) => (item.studentId === saved.studentId ? saved : item))
        : [...current.exams, saved];
      return { ...current, exams, progress: buildClassProgress(current.students, exams) };
    });
  }

  function removeDraft(studentId: string) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
  }

  function activeDraft(): ExamDraft | undefined {
    return selectedStudent ? drafts[selectedStudent.studentId] : undefined;
  }

  function savedExam(): Exam | undefined {
    return selectedStudent
      ? data?.exams.find((exam) => exam.studentId === selectedStudent.studentId)
      : undefined;
  }

  if (authenticated === null) return <main className="loading">평가 데이터를 확인하고 있습니다...</main>;
  if (!authenticated || !visibleData) return <LoginView busy={busy} error={error} onLogin={login} />;

  const draft = activeDraft();
  const saved = savedExam();
  const exam = draft?.exam ?? saved;
  const detectedConflict: ExamConflict | null =
    draft && isDraftStale(draft, saved)
      ? { code: "VERSION_CONFLICT", latestExam: saved ?? null }
      : null;
  const visibleConflict = conflict ?? detectedConflict;

  if (selectedStudent && exam) {
    return (
      <ExamView
        key={exam.examId}
        exam={exam}
        questions={visibleData.questions}
        settings={visibleData.settings}
        busy={busy}
        dirty={Boolean(draft)}
        conflict={visibleConflict}
        error={error}
        onBack={() => {
          setError("");
          setConflict(null);
          setSelectedStudent(null);
        }}
        onChange={updateDraft}
        onDiscard={draft ? discardActiveDraft : undefined}
        onSubmit={submitDraft}
        onUseLatest={() => acceptLatestRecord(visibleConflict?.latestExam ?? null)}
        onForceSubmit={() => draft && submitDraft(draft.exam, true)}
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
  return (
    <Dashboard
      data={visibleData}
      draftCount={Object.keys(drafts).length}
      onClearDrafts={clearAllDrafts}
      onSelectStudent={selectStudent}
      onLogout={logout}
    />
  );
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly latestExam: Exam | null = null,
  ) {
    super(message);
  }
}

async function request<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new ApiRequestError(
      payload.error ?? "요청을 처리하지 못했습니다.",
      payload.code,
      payload.latestExam ?? null,
    );
  }
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
    return parseDrafts(
      window.localStorage.getItem(DRAFT_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY),
    );
  } catch {
    return {};
  }
}
