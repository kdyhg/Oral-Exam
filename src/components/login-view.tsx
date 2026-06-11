"use client";

import { useState, type FormEvent } from "react";

export function LoginView({
  busy,
  error,
  onLogin,
}: {
  busy: boolean;
  error: string;
  onLogin: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(pin);
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand-mark">f(x)</div>
        <p className="eyebrow">2026 · Algebra Docent</p>
        <h1>말로 풀고,<br />정확히 기록합니다.</h1>
        <p>대수 수학개념 도슨트 구술평가 운영 화면입니다. 교사용 PIN으로 시작해 주세요.</p>
        <div className="field">
          <label htmlFor="pin">교사용 PIN</label>
          <input
            id="pin"
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoFocus
          />
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="button wide" disabled={busy || !pin} type="submit">
          {busy ? "확인 중..." : "평가 화면 열기"}
        </button>
      </form>
    </main>
  );
}
