"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MathText } from "@/components/math-text";
import { canRedraw, currentQuestionId, timerStartedAt } from "@/lib/exam-rules";
import { LEVEL_NAMES, OUTCOME_LABELS } from "@/lib/labels";
import { calculateScore, outcomeOptions, REDRAW_PENALTY } from "@/lib/scoring";
import type { AppSettings, Exam, ExamConflict, Outcome, Question } from "@/lib/types";

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
  onRedraw,
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
  onRedraw: () => void;
  onDiscard?: () => void;
  onSubmit: (exam: Exam) => Promise<void>;
  onUseLatest: () => void;
  onForceSubmit: () => void;
}) {
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const questionId = currentQuestionId(exam);
  const question = questionId ? questionById.get(questionId) : undefined;
  const redrawn = Boolean(exam.redrawQuestionId);
  const completed = exam.status === "COMPLETED";
  const timerStart = timerStartedAt(exam);

  function change(patch: Partial<Exam>) {
    onChange({ ...exam, ...patch, updatedAt: new Date().toISOString() });
  }

  function chooseOutcome(outcome: Outcome) {
    if (exam.outcome === outcome) return;
    change({ outcome, score: calculateScore(exam.level, redrawn, outcome) });
  }

  function redraw() {
    if (
      window.confirm(
        `같은 난이도에서 다시 뽑을까요?\n해결하면 ${REDRAW_PENALTY}점이 차감되고 타이머가 다시 시작됩니다.`,
      )
    ) {
      onRedraw();
    }
  }

  async function complete() {
    if (!exam.outcome) return;
    await onSubmit({ ...exam, status: "COMPLETED" });
  }

  return (
    <main className="page exam">
      <header className="bar">
        <div>
          <h1 className="title">{exam.name}</h1>
          <p className="meta">
            {exam.className} {exam.number}번 · {LEVEL_NAMES[exam.level]}
            {redrawn ? " · 다시 뽑음" : ""}
          </p>
        </div>
        <ExamTimer
          key={timerStart}
          startedAt={timerStart}
          durationSeconds={settings.durationSeconds}
          warningSeconds={settings.warningSeconds}
        />
        <button className="button" type="button" onClick={onBack}>학생 목록</button>
      </header>

      {error ? <p className="notice" role="alert">{error}</p> : null}
      {conflict ? (
        <div className="notice conflict" role="alert">
          <span>다른 기기에서 먼저 저장된 기록이 있습니다.</span>
          <div className="actions">
            <button className="button" type="button" disabled={busy} onClick={onUseLatest}>
              최신 기록 불러오기
            </button>
            <button className="button danger" type="button" disabled={busy} onClick={onForceSubmit}>
              현재 결과로 덮어쓰기
            </button>
          </div>
        </div>
      ) : null}

      <div className="exam-grid">
        <section className="question" aria-label="문제">
          {exam.level === "OWN" ? (
            <p className="prompt">학생이 준비한 문제</p>
          ) : question ? (
            <>
              <h2 className="question-title">{question.title}</h2>
              <p className="prompt"><MathText>{question.prompt}</MathText></p>
            </>
          ) : (
            <p className="notice">문항을 찾을 수 없습니다. 문항목록 Sheet를 확인해 주세요.</p>
          )}
        </section>

        <aside className="controls">
          <div className="outcomes" role="group" aria-label="결과">
            {outcomeOptions(exam.level, redrawn).map((option) => (
              <button
                className="outcome"
                key={option.outcome}
                type="button"
                disabled={busy}
                aria-pressed={exam.outcome === option.outcome}
                onClick={() => chooseOutcome(option.outcome)}
              >
                <span>{OUTCOME_LABELS[option.outcome]}</span>
                <span>{option.points}점</span>
              </button>
            ))}
          </div>

          {exam.level !== "OWN" ? (
            <button
              className="button wide"
              type="button"
              disabled={busy || !canRedraw(exam, questions)}
              onClick={redraw}
            >
              {redrawn ? "다시 뽑기 사용함" : `다시 뽑기 (−${REDRAW_PENALTY}점)`}
            </button>
          ) : null}

          <label className="label" htmlFor="memo">메모</label>
          <textarea
            id="memo"
            className="textarea"
            maxLength={1000}
            value={exam.memo}
            onChange={(event) => change({ memo: event.target.value })}
          />

          <div className="actions end">
            {onDiscard ? (
              <button className="button danger" type="button" disabled={busy} onClick={onDiscard}>
                {completed ? "수정 취소" : "평가 취소"}
              </button>
            ) : null}
            <button
              className="button primary"
              type="button"
              disabled={busy || !dirty || Boolean(conflict) || !exam.outcome}
              onClick={complete}
            >
              {busy ? "저장 중" : completed ? "저장" : "평가 완료"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ExamTimer({
  startedAt,
  durationSeconds,
  warningSeconds,
}: {
  startedAt: string;
  durationSeconds: number;
  warningSeconds: number;
}) {
  const [remaining, setRemaining] = useState(() => getRemaining(startedAt, durationSeconds));
  const warned = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    const update = () => setRemaining(getRemaining(startedAt, durationSeconds));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, durationSeconds]);

  useEffect(() => {
    if (remaining <= warningSeconds && remaining > 0 && !warned.current) {
      warned.current = true;
      beep(540);
    }
    if (remaining === 0 && !ended.current) {
      ended.current = true;
      beep(320);
    }
  }, [remaining, warningSeconds]);

  const state = remaining === 0 ? "ended" : remaining <= warningSeconds ? "warning" : "";
  return (
    <div className={`timer ${state}`} role="timer" aria-label="남은 시간">
      {formatTime(remaining)}
    </div>
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

