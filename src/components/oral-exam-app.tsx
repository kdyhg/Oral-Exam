"use client";

import { useEffect, useMemo, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { ExamView } from "@/components/exam-view";
import { LoginView } from "@/components/login-view";
import { QuestionChooser } from "@/components/question-chooser";
import { ScoreResultView } from "@/components/score-result-view";
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
import type {
  BootstrapData,
  Exam,
  ExamConflict,
  ExamDraft,
  ExamResetResult,
  Student,
} from "@/lib/types";

export function OralExamApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState("2-1");
  const [scoreResultExam, setScoreResultExam] = useState<Exam | null>(null);
  const [drafts, setDrafts] = useState<ExamDrafts>(readBrowserDrafts);
  const [conflict, setConflict] = useState<ExamConflict | null>(null);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
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
    setScoreResultExam(null);
    setConflict(null);
    setAuthenticated(false);
  }

  function selectStudent(student: Student) {
    setError("");
    setConflict(null);
    setScoreResultExam(null);
    setSelectedClass(student.className);
    setSelectedStudent(student);
  }

  function startExam(selfQuestionId: string) {
    if (!selectedStudent || !data) return;
    const randomQuestionIds = pickRandomQuestionIds(
      data.questions.filter((question) => question.type === "RANDOM").map((question) => question.id),
    );
    const now = new Date().toISOString();
    const currentRevision = data.recordRevisions[selectedStudent.studentId] ?? 0;
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
      revision: currentRevision,
    };
    setDrafts((current) => ({
      ...current,
      [exam.studentId]: { exam, baseRevision: currentRevision, touchedAt: now },
    }));
  }

  function updateDraft(exam: Exam) {
    const now = new Date().toISOString();
    setDrafts((current) => ({
      ...current,
      [exam.studentId]: {
        exam,
        baseRevision:
          current[exam.studentId]?.baseRevision ??
          data?.recordRevisions[exam.studentId] ??
          0,
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
      setSelectedClass(saved.className);
      setSelectedStudent(null);
      setScoreResultExam(saved);
      setConflict(null);
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && saveError.code === "VERSION_CONFLICT") {
        setConflict({
          code: "VERSION_CONFLICT",
          latestExam: saveError.latestExam,
          latestRevision: saveError.latestRevision,
        });
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

  function goHomeFromScore() {
    if (scoreResultExam) setSelectedClass(scoreResultExam.className);
    setScoreResultExam(null);
    setSelectedStudent(null);
    setConflict(null);
    setError("");
  }

  function acceptLatestRecord(latestExam: Exam | null, latestRevision: number) {
    if (selectedStudent) {
      setData((current) => {
        if (!current) return current;
        const exams = latestExam
          ? current.exams.some((item) => item.studentId === latestExam.studentId)
            ? current.exams.map((item) =>
                item.studentId === latestExam.studentId ? latestExam : item,
              )
            : [...current.exams, latestExam]
          : current.exams.filter(
              (item) => item.studentId !== selectedStudent.studentId,
            );
        return {
          ...current,
          exams,
          recordRevisions: {
            ...current.recordRevisions,
            [selectedStudent.studentId]: latestRevision,
          },
          progress: buildClassProgress(current.students, exams),
        };
      });
      removeDraft(selectedStudent.studentId);
    }
    setConflict(null);
    setError("");
  }

  function replaceSavedExam(saved: Exam) {
    setData((current) => {
      if (!current) return current;
      const exams = current.exams.some((item) => item.studentId === saved.studentId)
        ? current.exams.map((item) => (item.studentId === saved.studentId ? saved : item))
        : [...current.exams, saved];
      return {
        ...current,
        exams,
        recordRevisions: {
          ...current.recordRevisions,
          [saved.studentId]: saved.revision,
        },
        progress: buildClassProgress(current.students, exams),
      };
    });
  }

  async function resetStudentRecord(student: Student) {
    const saved = data?.exams.find(
      (exam) => exam.studentId === student.studentId && exam.status === "COMPLETED",
    );
    if (!saved) return;
    if (
      !window.confirm(
        `${student.className} ${student.number}번 ${student.name} 학생의 완료 기록을 초기화하시겠습니까?\n\n학생은 미평가 상태로 돌아가며, 기존 결과는 평가이력에 보존됩니다.`,
      )
    ) {
      return;
    }

    setResettingStudentId(student.studentId);
    setError("");
    try {
      const result = await request<ExamResetResult>(
        `/api/exams/${encodeURIComponent(student.studentId)}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            baseRevision: data?.recordRevisions[student.studentId] ?? saved.revision,
          }),
        },
      );
      setData((current) => {
        if (!current) return current;
        const exams = current.exams.filter((exam) => exam.studentId !== result.studentId);
        return {
          ...current,
          exams,
          recordRevisions: {
            ...current.recordRevisions,
            [result.studentId]: result.revision,
          },
          progress: buildClassProgress(current.students, exams),
        };
      });
      removeDraft(result.studentId);
    } catch (resetError) {
      if (resetError instanceof ApiRequestError && resetError.code === "VERSION_CONFLICT") {
        const payload = await fetchBootstrap();
        if (payload) setData(payload);
      }
      setError(message(resetError));
    } finally {
      setResettingStudentId(null);
    }
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

  if (scoreResultExam) {
    return <ScoreResultView exam={scoreResultExam} onHome={goHomeFromScore} />;
  }

  const draft = activeDraft();
  const saved = savedExam();
  const exam = draft?.exam ?? saved;
  const currentRevision = selectedStudent
    ? visibleData.recordRevisions[selectedStudent.studentId] ?? 0
    : 0;
  const detectedConflict: ExamConflict | null =
    draft && isDraftStale(draft, currentRevision)
      ? {
          code: "VERSION_CONFLICT",
          latestExam: saved ?? null,
          latestRevision: currentRevision,
        }
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
        onUseLatest={() =>
          acceptLatestRecord(
            visibleConflict?.latestExam ?? null,
            visibleConflict?.latestRevision ?? currentRevision,
          )
        }
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
      error={error}
      selectedClass={selectedClass}
      resettingStudentId={resettingStudentId}
      onClearDrafts={clearAllDrafts}
      onSelectClass={setSelectedClass}
      onResetStudent={resetStudentRecord}
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
    readonly latestRevision = 0,
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
      payload.latestRevision ?? 0,
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
