// lib/api/client.ts
// One typed client for every /my/api/* and /my/* call. Prefixes API_URL,
// sends credentials so the Auth0 `appSession` cookie set by the WebView
// login flow rides along, JSON-parses, and flips the auth store to
// logged-out on any 401.
import { API_URL } from "./config";
import { useAuthStore } from "../stores/authStore";
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;
  const url = buildUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(0, null, "Netwerkfout: kon geen verbinding maken met de server.");
  }

  if (response.status === 401) {
    useAuthStore.getState().setUnauthenticated();
    throw new ApiError(401, null, "Sessie verlopen. Log opnieuw in.");
  }

  let json: unknown = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errBody = (json as ApiErrorBody) ?? null;
    throw new ApiError(
      response.status,
      errBody,
      errBody?.message || errBody?.error || `Aanvraag mislukt (${response.status}).`
    );
  }

  return json as T;
}
