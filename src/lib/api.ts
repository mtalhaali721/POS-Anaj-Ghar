import { CounterError, dispatch } from "@/lib/book";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, "https://andaj.local");
  const request = new Request(url, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  });
  const slug = url.pathname.split("/").filter((part) => part && part !== "api");
  let response: Response;
  try {
    response = await dispatch(request, slug);
  } catch (err) {
    if (err instanceof CounterError) throw new ApiError(err.message, err.status);
    throw err;
  }
  if (!response.ok) {
    let message = "The counter could not reach the mill book.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}
