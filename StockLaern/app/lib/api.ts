const DEFAULT_API_BASE_URL = "https://winston-uncastigated-addictedly.ngrok-free.dev";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
};

type ApiError = {
  message: string;
  status: number;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...NGROK_HEADERS,
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      "Request failed. Please try again.";
    const error: ApiError = { message, status: response.status };
    throw error;
  }

  return payload as T;
}
