"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resultFields, resultValues } from "@/lib/actions";
import { useActionState } from "react";
import { buttonStyles, linkStyles, Notice } from "@/components/ui";
import { PolicyConsent, SIGNUP_POLICY_SLUGS } from "@/features/policies/client";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordWithOtpAction,
  resetPasswordWithTokenAction,
  signUpAction
} from "../actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";

const formClass = "flex flex-col gap-5";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className={formClass} noValidate>
        {params.get("reset") === "1" && !(state && "error" in state) && (
          <Notice tone="success">Your password was changed. Log in with the new password.</Notice>
        )}
        <FormMessage state={state} />
        <input type="hidden" name="callbackUrl" value={params.get("callbackUrl") ?? "/account"} />
        <Field label="Mobile number or email" name="identifier" autoComplete="username" required defaultValue={resultValues(state).identifier} />
        <div className="flex flex-col gap-1">
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <Link className={`${linkStyles} inline-flex min-h-11 items-center self-end text-sm`} href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <SubmitButton block>Log in</SubmitButton>
      </form>
      <p className="flex flex-col gap-2 text-center text-muted">
        New here?
        <Link className={buttonStyles({ variant: "secondary", size: "lg", block: true })} href="/signup">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, undefined);
  const f = resultFields(state);
  const v = resultValues(state);
  return (
    <div className="flex flex-col gap-6">
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
        <SubmitButton block>Create account</SubmitButton>
      </form>
      <p className="text-center text-muted">
        Already have an account?{" "}
        <Link className={`${linkStyles} inline-flex min-h-11 items-center font-medium`} href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <div className="flex flex-col gap-6">
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
        <SubmitButton block>Continue</SubmitButton>
      </form>
      <p className="text-center">
        <Link className={`${linkStyles} inline-flex min-h-11 items-center font-medium`} href="/login">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useActionState(resetPasswordWithTokenAction, undefined);
  if (!token)
    return (
      <Notice tone="error">
        This reset link is incomplete. <Link className={linkStyles} href="/forgot-password">Ask for a new one.</Link>
      </Notice>
    );
  return (
    <form action={action} className={formClass} noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." error={resultFields(state).password} />
      <SubmitButton block>Change password</SubmitButton>
    </form>
  );
}

export function ResetPasswordSmsForm() {
  const phone = useSearchParams().get("phone") ?? "";
  const [state, action] = useActionState(resetPasswordWithOtpAction, undefined);
  const f = resultFields(state);
  return (
    <form action={action} className={formClass} noValidate>
      <Notice tone="info">If an account uses this mobile number, we sent a 6-digit code by SMS. It works for 5 minutes.</Notice>
      <FormMessage state={state} />
      <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" defaultValue={phone} required error={f.phone} />
      <Field
        label="Code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        error={f.code}
        className="text-center text-2xl font-semibold tabular tracking-[0.35em]"
      />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." error={f.password} />
      <SubmitButton block>Change password</SubmitButton>
    </form>
  );
}
