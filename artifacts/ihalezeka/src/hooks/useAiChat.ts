import { useState, useCallback, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export interface AiChatContext {
  mode: "general" | "proposal";
  tender?: {
    title?: string;
    agency?: string;
    estimatedValue?: number | null;
    deadline?: string | null;
    aiSummary?: string | null;
    type?: string | null;
  };
  currentDraft?: string;
}

export function useAiChat(
  initialMessage: string,
  context?: AiChatContext,
  onProposalPatch?: (newDraft: string) => void
) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: "assistant", content: initialMessage },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [streamDone, setStreamDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return;

      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStreamDone(false);
      setElapsedMs(0);
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()));
      }, 100);

      const userMsg: AiChatMessage = { role: "user", content: userText };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantPlaceholder: AiChatMessage = {
        role: "assistant",
        content: "",
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantPlaceholder]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const historyForApi = [...messages, userMsg]
          .filter((m) => !m.streaming)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(`${API_BASE}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForApi,
            context: context ?? { mode: "general" },
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;

            let parsed: { delta?: string; error?: string; proposalPatch?: string } | null = null;
            try {
              parsed = JSON.parse(data) as { delta?: string; error?: string; proposalPatch?: string };
            } catch {
              continue;
            }

            if (parsed?.error) {
              throw new Error(parsed.error);
            }
            if (parsed?.proposalPatch && onProposalPatch) {
              onProposalPatch(parsed.proposalPatch);
            }
            if (parsed?.delta) {
              accumulated += parsed.delta;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: accumulated };
                }
                return next;
              });
            }
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = {
              role: "assistant",
              content: accumulated || "Yanıt alınamadı.",
            };
          }
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.streaming) {
              next[next.length - 1] = {
                role: "assistant",
                content: last.content || "İptal edildi.",
              };
            }
            return next;
          });
        } else {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.streaming) {
              next[next.length - 1] = {
                role: "assistant",
                content: "Şu anda AI asistana ulaşamıyorum, lütfen tekrar deneyin.",
              };
            }
            return next;
          });
        }
      } finally {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setElapsedMs(Date.now() - (startTimeRef.current ?? Date.now()));
        setStreamDone(true);
        setIsStreaming(false);
        abortRef.current = null;
        doneTimerRef.current = setTimeout(() => {
          setElapsedMs(null);
          setStreamDone(false);
        }, 3000);
      }
    },
    [messages, isStreaming, context, onProposalPatch]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, elapsedMs, streamDone, sendMessage, cancelStream };
}
