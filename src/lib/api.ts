import { supabase } from "./supabase";

// fetch() for our own /api routes, authenticated with the current Supabase session.
export async function apiFetch(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Pulls a human-readable error out of a failed API response.
export async function apiError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json();
    return new Error(payload.error || fallback);
  } catch {
    return new Error(fallback);
  }
}
