import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api";

export type SSEEvent = {
  type: "chunk" | "final" | "ping" | "error";
  data: string;
};

export type UseSSEOptions = {
  onChunk?: (data: string) => void;
  onFinal?: (data: string) => void;
  onError?: (error: Error) => void;
};

export function useSSE(runId: string | null, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!runId) {
      disconnect();
      return;
    }

    const url = `${api.baseUrl}/runs/${runId}/stream?token=${api.token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsComplete(false);
    };

    eventSource.addEventListener("chunk", (event) => {
      try {
        const data = JSON.parse(event.data);
        const text = data?.data ?? data?.text ?? data?.content ?? "";
        if (text && options.onChunk) {
          options.onChunk(text);
        }
      } catch (e) {
        console.error("Failed to parse chunk:", e);
      }
    });

    eventSource.addEventListener("final", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (options.onFinal) {
          options.onFinal(JSON.stringify(data));
        }
      } catch (e) {
        console.error("Failed to parse final:", e);
      }
      setIsComplete(true);
      disconnect();
    });

    eventSource.addEventListener("ping", () => {
      // Keep-alive, no action needed
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      if (options.onError) {
        options.onError(new Error("SSE connection error"));
      }
      disconnect();
    };

    return () => {
      disconnect();
    };
  }, [runId, options.onChunk, options.onFinal, options.onError, disconnect]);

  return { isConnected, isComplete, disconnect };
}
