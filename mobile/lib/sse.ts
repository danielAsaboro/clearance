import EventSource from "react-native-sse";
import { API_URL } from "./api";

interface SSEOptions {
  /** Called for each parsed event */
  onMessage: (data: unknown) => void;
  /** Called on errors */
  onError?: (error: unknown) => void;
  /** Called when connection opens */
  onOpen?: () => void;
  /** Bearer token for auth */
  token?: string | null;
}

/**
 * Create an SSE connection with auto-reconnect + exponential backoff.
 * Returns a cleanup function.
 */
export function connectSSE(path: string, options: SSEOptions): () => void {
  const { onMessage, onError, onOpen, token } = options;
  let retryCount = 0;
  let es: EventSource | null = null;
  let disposed = false;

  function connect() {
    if (disposed) return;

    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    es = new EventSource(url, { headers });

    es.addEventListener("open", () => {
      retryCount = 0;
      onOpen?.();
    });

    es.addEventListener("message", (event: any) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("error", (event: any) => {
      onError?.(event);
      es?.close();

      if (!disposed) {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        retryCount++;
        setTimeout(connect, delay);
      }
    });
  }

  connect();

  return () => {
    disposed = true;
    es?.close();
  };
}
