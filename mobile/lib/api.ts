import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://spotr.tv";

let _getAccessToken: (() => Promise<string | null>) | null = null;

/** Called once from the auth provider to wire up token retrieval */
export function setTokenGetter(fn: () => Promise<string | null>) {
  _getAccessToken = fn;
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Authenticated fetch wrapper.
 * Automatically adds Bearer token and JSON content type.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (_getAccessToken) {
    const token = await _getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText, url);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public url: string
  ) {
    super(`API ${status}: ${body}`);
    this.name = "ApiError";
  }
}

export { API_URL };
