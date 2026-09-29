"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MathText } from "@/components/math-text";
import { canRedraw, currentQuestionId, timerStartedAt } from "@/lib/exam-rules";
import { LEVEL_TITLES } from "@/lib/labels";
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
  const firstQuestion = exam.firstQuestionId ? questionById.get(exam.firstQuestionId) : undefined;
  const redrawn = Boolean(exam.redrawQuestionId);
  const options = outcomeOptions(exam.level, redrawn);
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
        `같은 난이도에서 문제를 다시 뽑으시겠습니까?\n\n다시 뽑으면 해결 시 점수가 ${REDRAW_PENALTY}점 차감되고, 타이머가 새로 시작됩니다. 다시 뽑기는 한 번만 할 수 있습니다.`,
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
    <main className="shell exam-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f′(x)</div>
          <div>
            <h1>미적분 수학개념 도슨트</h1>
            <p>평가 중에는 이 기기에만 저장되며, 평가 완료 시 Google Sheet에 한 번 저장됩니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onBack}>학생 목록</button>
      </header>

      <section className="card exam-header">
        <div>
          <p>{exam.className} · {exam.number}번 · {exam.round}차</p>
          <h2>{exam.name}</h2>
          <p>
            {LEVEL_TITLES[exam.level]}
            {redrawn ? " · 다시 뽑음" : ""}
            {" · "}
            {exam.status === "COMPLETED"
              ? dirty
                ? "완료 기록 수정 중 · 저장 전"
                : "완료 기록 확인 · 변경 시 로컬 초안 생성"
              : "평가 진행 중 · 로컬 초안 저장됨"}
          </p>
        </div>
        <ExamTimer
          key={timerStart}
          startedAt={timerStart}
          durationSeconds={settings.durationSeconds}
          warningSeconds={settings.warningSeconds}
        />
      </section>

      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {busy ? <div className="notice info">최종 평가 결과를 Google Sheet에 저장하고 있습니다...</div> : null}
      {conflict ? (
        <section className="notice conflict-notice" role="alert">
          <div>
            <strong>다른 기기에서 이 학생의 기록이 먼저 변경되었습니다.</strong>
            <span>최신 상태를 불러오거나, 현재 화면의 결과로 강제 저장할 수 있습니다.</span>
          </div>
          <div className="conflict-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={onUseLatest}>
              최신 상태 불러오기
            </button>
            <button className="button danger" type="button" disabled={busy} onClick={onForceSubmit}>
              현재 결과 강제 저장
            </button>
          </div>
        </section>
      ) : null}

      <section className="exam-main">
        <article className="card question-card">
          <p className="question-kicker">{redrawn ? "REDRAWN QUESTION" : "QUESTION"}</p>
          {exam.level === "OWN" ? (
            <>
              <h3>자신이 준비한 문제</h3>
              <p className="question-text">학생이 준비해 온 문제를 제한 시간 안에 풀고 풀이 과정을 설명합니다.</p>
            </>
          ) : question ? (
            <>
              <h3>{question.title}</h3>
              <p className="question-text"><MathText>{question.prompt}</MathText></p>
            </>
          ) : (
            <div className="notice error">배정된 문항을 찾을 수 없습니다. 문항목록 Sheet를 확인해 주세요.</div>
          )}
        </article>

        <aside className="exam-side">
          {exam.level !== "OWN" ? (
            <section className="card side-panel">
              <p className="question-kicker">REDRAW</p>
              {redrawn ? (
                <p className="side-text">
                  다시 뽑기 사용 · 처음 문항: {firstQuestion?.title ?? exam.firstQuestionId}
                </p>
              ) : (
                <p className="side-text">
                  문제를 제대로 설명하지 못하면 같은 난이도에서 한 번 다시 뽑을 수 있습니다. (−{REDRAW_PENALTY}점)
                </p>
              )}
              <button
                className="button secondary wide redraw-button"
                type="button"
                disabled={busy || !canRedraw(exam, questions)}
                onClick={redraw}
              >
                {redrawn ? "다시 뽑기 사용 완료" : "같은 난이도에서 다시 뽑기"}
              </button>
            </section>
          ) : null}

          <section className="card side-panel">
            <p className="question-kicker" id="outcome-label">RESULT</p>
            <div className="outcome-list" role="group" aria-labelledby="outcome-label">
              {options.map((option) => (
                <button
                  className={`outcome-option ${exam.outcome === option.outcome ? "selected" : ""}`}
                  key={option.outcome}
                  type="button"
                  disabled={busy}
                  aria-pressed={exam.outcome === option.outcome}
                  onClick={() => chooseOutcome(option.outcome)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <em>{option.points}점</em>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="card exam-footer">
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
            disabled={busy || !dirty || Boolean(conflict) || !exam.outcome}
            onClick={complete}
          >
            {exam.status === "COMPLETED" ? "평가 결과 저장" : "평가 완료"}
            {exam.score !== null && exam.outcome ? ` · ${exam.score}점` : ""}
          </button>
        </div>
      </section>
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

  const timerState = remaining === 0 ? "ended" : remaining <= warningSeconds ? "warning" : "";
  return (
    <div className={`timer ${timerState}`} role="timer" aria-label="남은 평가 시간">
      <strong>{formatTime(remaining)}</strong>
      <span>{remaining === 0 ? "평가 시간 종료" : "남은 시간"}</span>
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

