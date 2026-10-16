import { toErrorBody } from "./errors";
import type { CategorySchema } from "./schema";
import { getCategorySchema } from "./service";

/** GET /api/categories/:id/schema. Public: catalog structure is not sensitive. */
export async function schemaResponse(
  id: string,
  load: (id: string) => Promise<CategorySchema> = getCategorySchema,
): Promise<Response> {
  try {
    return Response.json(await load(id));
  } catch (err) {
    const { status, body } = toErrorBody(err);
    return Response.json(body, { status });
  }
}
