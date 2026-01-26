import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, ThreadDetail } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, User, Bot, Loader2, MoreVertical, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkWorkspaceDialog } from "@/components/thread/LinkWorkspaceDialog";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
};

export function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkWorkspaceOpen, setLinkWorkspaceOpen] = useState(false);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check for run_id in URL params (from new thread creation)
  useEffect(() => {
    const runId = searchParams.get("run_id");
    if (runId) {
      setCurrentRunId(runId);
      // Clean up the URL
      navigate(`/t/${threadId}`, { replace: true });
    }
  }, [searchParams, threadId, navigate]);

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

        // Turns are nested inside data.thread.turns
        const turns = data.turns || data.thread?.turns;
        const items = data.items || data.thread?.items;

        if (turns) {
          for (const turn of turns) {
            if (turn.items) {
              for (const item of turn.items) {
                // Extract text from content array if needed
                let content = "";
                if (typeof item.content === "string") {
                  content = item.content;
                } else if (Array.isArray(item.content)) {
                  content = item.content
                    .map((c: any) => c.text || c.content || "")
                    .join("");
                } else if (item.text) {
                  content = item.text;
                }

                if (content) {
                  parsedMessages.push({
                    id: item.id || `${turn.id}-${parsedMessages.length}`,
                    role: (item.type === "userMessage" ? "user" : "assistant") as DisplayMessage["role"],
                    content,
                  });
                }
              }
            } else if (turn.content) {
              parsedMessages.push({
                id: turn.id,
                role: (turn.role || "assistant") as DisplayMessage["role"],
                content: turn.content,
              });
            }
          }
        } else if (items) {
          for (const item of items) {
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
    setStreamingContent((prev) => {
      // Skip echo of user message (first chunk often echoes the user's input)
      if (!prev && data.trim() === lastUserMessage.trim()) {
        return prev;
      }
      return prev + data;
    });
  }, [lastUserMessage]);

  const handleFinal = useCallback(() => {
    // Move streaming content to messages using state updater to avoid stale closure
    setStreamingContent((content) => {
      if (content) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: content,
          },
        ]);
      }
      return "";
    });
    setCurrentRunId(null);
  }, []);

  useSSE(currentRunId, {
    onChunk: handleChunk,
    onFinal: handleFinal,
  });

  // Send message
  const handleSend = async (text: string) => {
    if (!threadId) return;

    // Track the user message to filter out echo
    setLastUserMessage(text);

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

  const handleCopyThreadId = () => {
    if (threadId) {
      navigator.clipboard.writeText(threadId);
      // Could add toast notification here if available
    }
  };

  const handleDelete = async () => {
    if (!threadId) return;
    if (!confirm("Are you sure you want to delete this thread?")) return;

    try {
      await api.delete(`/threads/${threadId}`);
      navigate(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete thread");
    }
  };

  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

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
    <div className="flex flex-col h-screen">
      {/* Thread Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-medium truncate flex-1 min-w-0">{threadTitle}</h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyThreadId}>
              Copy Thread ID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLinkWorkspaceOpen(true)}>
              Link to Workspace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              Delete Thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Search Input (Mobile-First) */}
      {searchOpen && (
        <div className="border-b border-border px-4 py-3 bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="container max-w-3xl mx-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation below.
            </div>
          )}

          {filteredMessages.map((message) => (
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

      {/* Link to Workspace Dialog */}
      <LinkWorkspaceDialog
        open={linkWorkspaceOpen}
        onOpenChange={setLinkWorkspaceOpen}
        threadId={threadId || ""}
      />
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
