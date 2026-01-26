import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ThreadDetail } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, User, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
};

export function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Fetch thread detail
  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<ThreadDetail>(`/threads/${threadId}`);
        setThread(data);

        // Parse messages from turns or items
        const parsedMessages: DisplayMessage[] = [];

        if (data.turns) {
          for (const turn of data.turns) {
            if (turn.items) {
              for (const item of turn.items) {
                parsedMessages.push({
                  id: item.id || `${turn.id}-${parsedMessages.length}`,
                  role: (item.role || turn.role || "assistant") as DisplayMessage["role"],
                  content: item.content || "",
                });
              }
            } else if (turn.content) {
              parsedMessages.push({
                id: turn.id,
                role: (turn.role || "assistant") as DisplayMessage["role"],
                content: turn.content,
              });
            }
          }
        } else if (data.items) {
          for (const item of data.items) {
            parsedMessages.push({
              id: item.id,
              role: item.role,
              content: item.content,
            });
          }
        }

        setMessages(parsedMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  // SSE streaming
  const handleChunk = useCallback((data: string) => {
    setStreamingContent((prev) => prev + data);
  }, []);

  const handleFinal = useCallback(() => {
    // Move streaming content to messages
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: streamingContent,
        },
      ]);
      setStreamingContent("");
    }
    setCurrentRunId(null);
  }, [streamingContent]);

  useSSE(currentRunId, {
    onChunk: handleChunk,
    onFinal: handleFinal,
  });

  // Send message
  const handleSend = async (text: string) => {
    if (!threadId) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      },
    ]);

    try {
      const response = await api.post<{ run_id: string }>(
        `/threads/${threadId}/message`,
        { text }
      );
      setCurrentRunId(response.run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const threadTitle =
    thread?.meta?.title_override ||
    thread?.thread?.title_override ||
    thread?.thread?.title ||
    `Thread ${threadId?.slice(0, 8)}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-medium truncate">{threadTitle}</h1>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="container max-w-3xl mx-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation below.
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Streaming message */}
          {streamingContent && (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingContent,
                isStreaming: true,
              }}
            />
          )}

          {/* Loading indicator while waiting for stream */}
          {currentRunId && !streamingContent && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 md:p-4">
        <div className="container max-w-3xl mx-auto">
          <MessageInput
            onSend={handleSend}
            disabled={!!currentRunId}
            placeholder="Send a message..."
          />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <Card className={cn("max-w-[80%]", isUser && "bg-primary/10")}>
        <CardContent className="p-3">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
