import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isTestMode } from "@/lib/config";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "UI kit · Marketplace", robots: { index: false } };

/** Living reference of the UI kit and tokens. Only available in test mode (404 otherwise). */
export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <Guarded />
    </Suspense>
  );
}

async function Guarded() {
  await connection(); // APP_MODE is read at request time
  if (!isTestMode()) notFound();
  return <Gallery />;
}
