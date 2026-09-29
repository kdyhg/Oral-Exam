"use client";

import { useState, type FormEvent } from "react";

export function LoginView({
  roundLabel,
  busy,
  error,
  onLogin,
  onBack,
}: {
  roundLabel: string;
  busy: boolean;
  error: string;
  onLogin: (pin: string) => Promise<void>;
  onBack: () => void;
}) {
  const [pin, setPin] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(pin);
  }

  return (
    <main className="center">
      <form className="panel narrow" onSubmit={submit}>
        <h1 className="title">{roundLabel} 평가</h1>
        <label className="label" htmlFor="pin">교사 PIN</label>
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
        {error ? <p className="notice" role="alert">{error}</p> : null}
        <button className="button primary wide" disabled={busy || !pin} type="submit">
          {busy ? "확인 중" : "시작"}
        </button>
        <button className="text-button" type="button" onClick={onBack}>차수 선택</button>
      </form>
    </main>
  );
}

