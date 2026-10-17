import { connection } from "next/server";
import { returnsApi } from "@/features/returns/server";

/** US-070: ask for a return (customer, or a guest with the order open). JSON or multipart with photos. */
export async function POST(req: Request) {
  await connection();
  return returnsApi.create(req);
}

/** The user's return requests, or ?orderNo= those on one order this browser may open. */
export async function GET(req: Request) {
  await connection();
  return returnsApi.list(req);
}
