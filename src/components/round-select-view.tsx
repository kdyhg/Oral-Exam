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
    <main className="center">
      <section className="panel narrow">
        <h1 className="title">미적분 수학개념 도슨트</h1>
        <div className="round-grid">
          {ROUNDS.map((round) => (
            <button
              className={`round ${round.open ? "" : "closed"}`}
              key={round.id}
              type="button"
              onClick={() => choose(round)}
            >
              {round.label}
            </button>
          ))}
        </div>
      </section>

      <dialog ref={dialogRef} className="dialog" onClose={() => setClosedRound(null)}>
        <p>{`${closedRound?.label ?? "2차"}는 준비중입니다.`}</p>
        <form method="dialog">
          <button className="button primary wide" type="submit" autoFocus>확인</button>
        </form>
      </dialog>
    </main>
  );
}

