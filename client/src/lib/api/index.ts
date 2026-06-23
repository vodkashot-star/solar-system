import { API_BASE } from "../config";

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, any>;
}

async function apiFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { body: requestBodyObject, ...restOfOptions } = options;

  const fetchOptions: RequestInit = {
    ...restOfOptions,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  if (requestBodyObject && options.method !== "GET" && options.method !== "HEAD") {
    fetchOptions.body = JSON.stringify(requestBodyObject);
  } else {
    delete fetchOptions.body;
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        throw new Error(`HTTP Error ${response.status}: Failed to parse error response.`);
      }
      throw new Error(errorData.error || `HTTP Error ${response.status}`);
    }

    if (response.status === 204 || response.headers.get("Content-Length") === "0") {
      return {} as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`API Call failed for ${url}:`, error.message);
    } else {
      console.error(`API Call failed for ${url}:`, error);
    }
    throw error;
  }
}

export async function checkHealth() {
  return apiFetch("/health");
}
