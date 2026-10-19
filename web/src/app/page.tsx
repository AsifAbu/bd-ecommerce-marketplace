import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { getHomeData } from "@/features/home/server";
import { DemoHint } from "@/features/home/ui/demo-hint";
import { Hero, HomeSections, HomeSkeleton } from "@/features/home/ui/home-view";
import { getConfig } from "@/lib/config";

export default function Home() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-6 sm:py-8">
      <Hero />
      <Suspense fallback={null}>
        <DemoHint />
      </Suspense>
      <Suspense fallback={<HomeSkeleton />}>
        <Sections />
      </Suspense>
    </Container>
  );
}

async function Sections() {
  await connection(); // products and counts change at request time
  return <HomeSections data={await getHomeData()} testMode={getConfig().appMode === "test"} />;
}
