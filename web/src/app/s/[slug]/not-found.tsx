import Link from "next/link";
import { buttonStyles, Container } from "@/components/ui";

export default function ShopNotFound() {
  return (
    <Container as="main" id="main" className="flex flex-1 flex-col items-start gap-3 py-10">
      <h1 className="text-3xl font-semibold">Shop not found</h1>
      <p className="max-w-prose text-muted">This shop doesn&apos;t exist or isn&apos;t open right now.</p>
      <Link className={buttonStyles({ variant: "secondary" })} href="/">
        Go to the home page
      </Link>
    </Container>
  );
}
