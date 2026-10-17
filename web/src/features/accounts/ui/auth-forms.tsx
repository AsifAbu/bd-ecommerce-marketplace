"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resultFields, resultValues } from "@/lib/actions";
import { useActionState } from "react";
import { PolicyConsent, SIGNUP_POLICY_SLUGS } from "@/features/policies/client";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordWithOtpAction,
  resetPasswordWithTokenAction,
  signUpAction
} from "../actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";

const formClass = "flex flex-col gap-4";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className={formClass} noValidate>
      {params.get("reset") === "1" && !(state && "error" in state) && (
        <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
          Your password was changed. Log in with the new password.
        </p>
      )}
      <FormMessage state={state} />
      <input type="hidden" name="callbackUrl" value={params.get("callbackUrl") ?? "/account"} />
      <Field label="Mobile number or email" name="identifier" autoComplete="username" required defaultValue={resultValues(state).identifier} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton>Log in</SubmitButton>
      <p className="text-sm">
        <Link className="underline" href="/forgot-password">
          Forgot password?
        </Link>{" "}
        · New here?{" "}
        <Link className="underline" href="/signup">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, undefined);
  const f = resultFields(state);
  const v = resultValues(state);
  return (
    <form action={action} className={formClass} noValidate>
      <FormMessage state={state} />
      <Field label="Full name" name="name" autoComplete="name" required error={f.name} defaultValue={v.name} />
      <Field
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="01XXXXXXXXX"
        hint="11 digits starting with 01. Give a mobile number, an email, or both."
        error={f.phone}
        defaultValue={v.phone}
      />
      <Field label="Email" name="email" type="email" autoComplete="email" error={f.email} defaultValue={v.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={f.password}
      />
      <PolicyConsent slugs={SIGNUP_POLICY_SLUGS} error={f.acceptPolicies} />
      <SubmitButton>Create account</SubmitButton>
      <p className="text-sm">
        Already have an account?{" "}
        <Link className="underline" href="/login">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className={formClass} noValidate>
      <FormMessage state={state} />
      <Field
        label="Mobile number or email"
        name="identifier"
        autoComplete="username"
        required
        hint="Email: we send a reset link. Mobile: we send a code by SMS."
        error={resultFields(state).identifier}
        defaultValue={resultValues(state).identifier}
      />
      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useActionState(resetPasswordWithTokenAction, undefined);
  if (!token) return <p role="alert">This reset link is incomplete. Ask for a new one.</p>;
  return (
    <form action={action} className={formClass} noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." error={resultFields(state).password} />
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}

export function ResetPasswordSmsForm() {
  const phone = useSearchParams().get("phone") ?? "";
  const [state, action] = useActionState(resetPasswordWithOtpAction, undefined);
  const f = resultFields(state);
  return (
    <form action={action} className={formClass} noValidate>
      <p role="status">If an account uses this mobile number, we sent a 6-digit code by SMS. It works for 5 minutes.</p>
      <FormMessage state={state} />
      <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" defaultValue={phone} required error={f.phone} />
      <Field label="Code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={f.code} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." error={f.password} />
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
