import { connection } from "next/server";
import { CounterError, dispatch } from "@/lib/book";

type Context = { params: Promise<{ slug?: string[] }> };

async function handle(request: Request, context: Context) {
  await connection();
  const { slug } = await context.params;
  try {
    return await dispatch(request, slug ?? []);
  } catch (err) {
    if (err instanceof CounterError) {
      return Response.json({ message: err.message }, { status: err.status });
    }
    if (err instanceof SyntaxError) {
      return Response.json({ message: "That request was not valid JSON." }, { status: 400 });
    }
    console.error(err);
    return Response.json({ message: "The mill book hit a problem." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
