"use client";

import { useRef, useState } from "react";

import { ROUNDS, type Round, type RoundOption } from "@/lib/rounds";

export function RoundSelectView({ onEnter }: { onEnter: (round: Round) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closedRound, setClosedRound] = useState<RoundOption | null>(null);

  function choose(round: RoundOption) {
    if (round.open) {
      onEnter(round.id);
      return;
    }
    setClosedRound(round);
    dialogRef.current?.showModal();
  }

  return (
    <main className="login-page">
      <section className="card login-card">
        <div className="brand-mark">f′(x)</div>
        <p className="eyebrow">2026 · Calculus Docent</p>
        <h1>미적분<br />수학개념 도슨트</h1>
        <p>2026학년도 2학년 2학기 구술 수행평가입니다. 진행할 평가 차수를 선택해 주세요.</p>
        <div className="round-grid">
          {ROUNDS.map((round) => (
            <button
              className={`round-button ${round.open ? "" : "closed"}`}
              key={round.id}
              type="button"
              onClick={() => choose(round)}
            >
              <strong>{round.label}</strong>
              <span>{round.open ? "평가 입장" : "준비중"}</span>
            </button>
          ))}
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="card modal"
        aria-labelledby="round-dialog-title"
        onClose={() => setClosedRound(null)}
      >
        <h2 id="round-dialog-title">안내</h2>
        <p>{`${closedRound?.label ?? "2차"}는 준비중입니다.`}</p>
        <form method="dialog">
          <button className="button wide" type="submit" autoFocus>확인</button>
        </form>
      </dialog>
    </main>
  );
}

