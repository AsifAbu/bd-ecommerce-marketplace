"use client";

import { resultFields, resultValues } from "@/lib/actions";
import { useActionState } from "react";
import {
  resendEmailVerificationAction,
  sendPhoneOtpAction,
  updateProfileAction,
  verifyPhoneAction
} from "../actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";


export interface ProfileDefaults {
  name: string;
  phone: string; // 01XXXXXXXXX
  email: string;
  avatarUrl: string;
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action] = useActionState(updateProfileAction, undefined);
  const f = resultFields(state);
  const v = { ...defaults, ...resultValues(state) };
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Full name" name="name" autoComplete="name" required error={f.name} defaultValue={v.name} />
      <Field
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="01XXXXXXXXX"
        hint="Changing it means verifying the new number by SMS code."
        error={f.phone}
        defaultValue={v.phone}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        hint="Changing it means verifying the new email by link."
        error={f.email}
        defaultValue={v.email}
      />
      <Field
        label="Avatar image URL (optional)"
        name="avatarUrl"
        type="url"
        placeholder="https://"
        error={f.avatarUrl}
        defaultValue={v.avatarUrl}
      />
      <SubmitButton className="self-start">Save profile</SubmitButton>
    </form>
  );
}

export function VerifyPhoneForms() {
  const [sendState, send] = useActionState(sendPhoneOtpAction, undefined);
  const [verifyState, verify] = useActionState(verifyPhoneAction, undefined);
  return (
    <div className="flex flex-col gap-8">
      <form action={send} className="flex flex-col gap-3" aria-label="Send a code">
        <FormMessage state={sendState} />
        <SubmitButton variant={sendState && "ok" in sendState ? "secondary" : "primary"} block>
          {sendState && "ok" in sendState ? "Send a new code" : "Send code by SMS"}
        </SubmitButton>
      </form>
      <form action={verify} className="flex flex-col gap-5" noValidate aria-label="Enter the code">
        <FormMessage state={verifyState} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          error={resultFields(verifyState).code}
          className="text-center text-2xl font-semibold tabular tracking-[0.35em]"
        />
        <SubmitButton block>Verify</SubmitButton>
      </form>
    </div>
  );
}

export function ResendEmailButton() {
  const [state, action] = useActionState(resendEmailVerificationAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <SubmitButton className="self-start">Send verification link</SubmitButton>
    </form>
  );
}
