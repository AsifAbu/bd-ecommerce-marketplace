"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";

/**
 * US-008: track an order without an account. Step 1 sends a code to the order's mobile, step 2
 * checks it and opens the order page (this browser gets access to that order for an hour).
 */
export function TrackForm({ initialOrderNo }: { initialOrderNo: string }) {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function call(body: Record<string, string>) {
    setBusy(true);
    try {
      const res = await fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { message?: string; url?: string; error?: { message: string; fields?: Record<string, string> } };
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: { error: { message: "Could not reach the server. Check your connection and try again." } } };
    } finally {
      setBusy(false);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const { ok, data } = await call({ orderNo });
    if (ok) setSent(true);
    setMessage(ok ? { text: data.message ?? "Code sent.", error: false } : { text: data.error?.fields?.orderNo ?? data.error?.message ?? "Could not send the code.", error: true });
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const { ok, data } = await call({ orderNo, code });
    if (!ok) {
      setMessage({ text: data.error?.fields?.code ?? data.error?.message ?? "That code is not right.", error: true });
      return;
    }
    router.push(data.url ?? "/");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={send} className="flex flex-col gap-3" noValidate aria-label="Send a code">
        <div className="flex flex-col gap-1">
          <label htmlFor="track-order-no" className="font-medium">
            Order number
          </label>
          <input
            id="track-order-no"
            name="orderNo"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="BD-261017-7KQ2M"
            autoCapitalize="characters"
            className={inputClass}
            required
          />
          <p className="text-sm text-gray-700">It is in your confirmation SMS and email.</p>
        </div>
        <button type="submit" className={`${buttonClass} self-start`} disabled={busy || !orderNo.trim()}>
          {sent ? "Send a new code" : "Send code by SMS"}
        </button>
      </form>
      {sent && (
        <form onSubmit={verify} className="flex flex-col gap-3" noValidate aria-label="Check the code">
          <div className="flex flex-col gap-1">
            <label htmlFor="track-code" className="font-medium">
              6-digit code
            </label>
            <input
              id="track-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} w-40`}
              required
            />
          </div>
          <button type="submit" className={`${buttonClass} self-start`} disabled={busy || code.trim().length !== 6}>
            View order
          </button>
        </form>
      )}
      <p role="status" aria-live="polite" className={`text-sm ${message?.error ? "font-semibold text-red-800" : "text-green-900"}`}>
        {message?.text}
      </p>
    </div>
  );
}
