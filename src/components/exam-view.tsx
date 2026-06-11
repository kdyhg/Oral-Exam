"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MarkButtons, QuestionCard } from "@/components/question-card";
import { applyHint, areScoresComplete } from "@/lib/exam-rules";
import type { AppSettings, Exam, ExamConflict, Mark, Question } from "@/lib/types";

export function ExamView({
  exam,
  questions,
  settings,
  busy,
  dirty,
  conflict,
  error,
  onBack,
  onChange,
  onDiscard,
  onSubmit,
  onUseLatest,
  onForceSubmit,
}: {
  exam: Exam;
  questions: Question[];
  settings: AppSettings;
  busy: boolean;
  dirty: boolean;
  conflict: ExamConflict | null;
  error: string;
  onBack: () => void;
  onChange: (exam: Exam) => void;
  onDiscard?: () => void;
  onSubmit: (exam: Exam, forceOverwrite?: boolean) => Promise<void>;
  onUseLatest: () => void;
  onForceSubmit: () => void;
}) {
  const [remaining, setRemaining] = useState(() => getRemaining(exam.startedAt, settings.durationSeconds));
  const warned = useRef(false);
  const ended = useRef(false);
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  useEffect(() => {
    const update = () => setRemaining(getRemaining(exam.startedAt, settings.durationSeconds));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [exam.startedAt, settings.durationSeconds]);

  useEffect(() => {
    if (remaining <= settings.warningSeconds && remaining > 0 && !warned.current) {
      warned.current = true;
      beep(540);
    }
    if (remaining === 0 && !ended.current) {
      ended.current = true;
      beep(320);
    }
  }, [remaining, settings.warningSeconds]);

  const assignedQuestions = exam.scores
    .map((score) => questionById.get(score.questionId))
    .filter((question): question is Question => Boolean(question));

  function change(patch: Partial<Exam>) {
    onChange({ ...exam, ...patch, updatedAt: new Date().toISOString() });
  }

  function mark(index: number, value: Exclude<Mark, null>) {
    if (exam.scores[index].correct === value) return;
    const scores = exam.scores.map((score, scoreIndex) =>
      scoreIndex === index ? { ...score, correct: value } : score,
    ) as Exam["scores"];
    change({ scores });
  }

  function useHint(questionId: string) {
    if (window.confirm("이 문항에 Hint를 사용하시겠습니까? 전체 평가에서 한 번만 사용할 수 있습니다.")) {
      change(applyHint(exam, questionId, new Date().toISOString()));
    }
  }

  async function complete() {
    if (!areScoresComplete(exam.scores, exam.fluency)) return;
    await onSubmit({ ...exam, status: "COMPLETED" });
  }

  const timerState = remaining === 0 ? "ended" : remaining <= settings.warningSeconds ? "warning" : "";

  return (
    <main className="shell exam-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f(x)</div>
          <div>
            <h1>대수 수학개념 도슨트</h1>
            <p>평가 중에는 이 기기에만 저장되며, 평가 완료 시 Google Sheet에 한 번 저장됩니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onBack}>학생 목록</button>
      </header>

      <section className="card exam-header">
        <div>
          <p>{exam.className} · {exam.number}번</p>
          <h2>{exam.name}</h2>
          <p>
            {exam.status === "COMPLETED"
              ? dirty
                ? "완료 기록 수정 중 · 저장 전"
                : "완료 기록 확인 · 변경 시 로컬 초안 생성"
              : "평가 진행 중 · 로컬 초안 저장됨"}
          </p>
        </div>
        <div className={`timer ${timerState}`} role="timer" aria-label="남은 평가 시간">
          <strong>{formatTime(remaining)}</strong>
          <span>{remaining === 0 ? "평가 시간 종료" : "남은 시간"}</span>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {busy ? <div className="notice info">최종 평가 결과를 Google Sheet에 저장하고 있습니다...</div> : null}
      {conflict ? (
        <section className="notice conflict-notice" role="alert">
          <div>
            <strong>다른 기기에서 이 학생의 기록이 먼저 저장되었습니다.</strong>
            <span>최신 기록을 불러오거나, 현재 화면의 결과로 강제 저장할 수 있습니다.</span>
          </div>
          <div className="conflict-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={onUseLatest}>
              최신 기록 불러오기
            </button>
            <button className="button danger" type="button" disabled={busy} onClick={onForceSubmit}>
              현재 결과 강제 저장
            </button>
          </div>
        </section>
      ) : null}

      <section className="question-list">
        {assignedQuestions.map((question, index) => (
          <QuestionCard
            key={question.id}
            index={index}
            question={question}
            score={exam.scores[index]}
            hintQuestionId={exam.hintQuestionId}
            busy={busy}
            onMark={mark}
            onHint={useHint}
          />
        ))}
      </section>

      <section className="card exam-footer">
        <div className="fluency-panel">
          <p className="question-kicker">STUDENT FLUENCY</p>
          <MarkButtons
            label="학생별 유창성"
            value={exam.fluency}
            disabled={busy}
            large
            onChange={(fluency) => {
              if (exam.fluency !== fluency) change({ fluency });
            }}
          />
        </div>
        <div className="field memo-field">
          <label htmlFor="memo">교사 메모</label>
          <textarea
            id="memo"
            className="textarea"
            maxLength={1000}
            placeholder="관찰 내용이나 후속 확인 사항을 기록하세요."
            value={exam.memo}
            onChange={(event) => change({ memo: event.target.value })}
          />
        </div>
        <div className="footer-actions">
          {onDiscard ? (
            <button className="button danger" type="button" disabled={busy} onClick={onDiscard}>
              {exam.status === "COMPLETED" ? "수정 취소" : "평가 취소"}
            </button>
          ) : null}
          <button
            className="button save-button"
            type="button"
            disabled={busy || !dirty || Boolean(conflict) || !areScoresComplete(exam.scores, exam.fluency)}
            onClick={complete}
          >
            {exam.status === "COMPLETED" ? "평가 결과 저장" : "평가 완료"}
          </button>
        </div>
      </section>
    </main>
  );
}

function getRemaining(startedAt: string, durationSeconds: number): number {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function beep(frequency: number) {
  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  } catch {
    // Visual timer state remains available when audio is blocked by the browser.
  }
}
