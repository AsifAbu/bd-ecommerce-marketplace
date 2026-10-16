"use client";

import { useActionState } from "react";
import {
  resendEmailVerificationAction,
  sendPhoneOtpAction,
  updateProfileAction,
  verifyPhoneAction,
  type FormState,
} from "../actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";

const initial: FormState = {};

export interface ProfileDefaults {
  name: string;
  phone: string; // 01XXXXXXXXX
  email: string;
  avatarUrl: string;
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action] = useActionState(updateProfileAction, initial);
  const f = state.fields ?? {};
  const v = { ...defaults, ...state.values };
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
  const [sendState, send] = useActionState(sendPhoneOtpAction, initial);
  const [verifyState, verify] = useActionState(verifyPhoneAction, initial);
  return (
    <div className="flex flex-col gap-6">
      <form action={send} className="flex flex-col gap-3">
        <FormMessage state={sendState} />
        <SubmitButton className="self-start">Send code by SMS</SubmitButton>
      </form>
      <form action={verify} className="flex flex-col gap-3" noValidate>
        <FormMessage state={verifyState} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          error={verifyState.fields?.code}
        />
        <SubmitButton className="self-start">Verify</SubmitButton>
      </form>
    </div>
  );
}

export function ResendEmailButton() {
  const [state, action] = useActionState(resendEmailVerificationAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <SubmitButton className="self-start">Send verification link</SubmitButton>
    </form>
  );
}
