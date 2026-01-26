# UI Rewrite Phase 3: Threads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Thread Detail page with full message history, SSE streaming integration, and microphone dictation support.

**Architecture:** ThreadDetailPage fetches thread history via `GET /threads/:id`, displays messages in a scrollable view, sends messages via `POST /threads/:id/message` which returns a `run_id`, then streams responses via `GET /runs/:id/stream` SSE. A reusable MessageInput component with dictation is shared between pages.

**Tech Stack:** React 18, EventSource API for SSE, Web Speech API for dictation, react-router-dom for navigation

---

## Task 1: Add Message Type to API

**Files:**
- Modify: `apps/ui/src/lib/api.ts`

**Step 1: Add Message type**

Add after the Thread type:

```typescript
export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
};

export type ThreadDetail = {
  thread: Thread;
  items?: Message[];
  turns?: Array<{
    id: string;
    role: string;
    content?: string;
    items?: Message[];
  }>;
  meta?: {
    title_override?: string;
    pinned?: boolean;
    archived?: boolean;
  };
  attached_workspace_ids?: string[];
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/lib/api.ts
git commit -m "feat(ui): add Message and ThreadDetail types"
```

---

## Task 2: Create useSSE Hook

**Files:**
- Create: `apps/ui/src/hooks/useSSE.ts`

**Step 1: Create the hook**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/hooks/useSSE.ts
git commit -m "feat(ui): add useSSE hook for SSE streaming"
```

---

## Task 3: Create useDictation Hook

**Files:**
- Create: `apps/ui/src/hooks/useDictation.ts`

**Step 1: Create the hook**

```typescript
import { useState, useRef, useCallback, useEffect } from "react";

type SpeechRecognitionType = typeof window.SpeechRecognition;

export function useDictation() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript: () => setTranscript(""),
  };
}
```

**Step 2: Add SpeechRecognition type declaration**

Create `apps/ui/src/types/speech.d.ts`:

```typescript
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition: SpeechRecognitionConstructor;
  webkitSpeechRecognition: SpeechRecognitionConstructor;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/ui/src/hooks/useDictation.ts apps/ui/src/types/speech.d.ts
git commit -m "feat(ui): add useDictation hook for voice input"
```

---

## Task 4: Create MessageInput Component

**Files:**
- Create: `apps/ui/src/components/thread/MessageInput.tsx`

**Step 1: Create the component**

```typescript
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDictation } from "@/hooks/useDictation";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  className,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isListening, transcript, isSupported, toggleListening, clearTranscript } =
    useDictation();

  // Append transcript to input when dictation produces results
  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      {isSupported && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          disabled={disabled}
          className={cn("shrink-0", isListening && "text-destructive")}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button
        onClick={handleSend}
        size="icon"
        disabled={disabled || !input.trim()}
        className="shrink-0"
      >
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/components/thread/MessageInput.tsx
git commit -m "feat(ui): add MessageInput component with dictation"
```

---

## Task 5: Create ThreadDetailPage

**Files:**
- Create: `apps/ui/src/pages/ThreadDetailPage.tsx`

**Step 1: Create the page component**

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ThreadDetail, Message } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="container max-w-3xl mx-auto p-4 space-y-4">
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
      <div className="border-t border-border p-4">
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/pages/ThreadDetailPage.tsx
git commit -m "feat(ui): add ThreadDetailPage with SSE streaming"
```

---

## Task 6: Wire Up Routing in App.tsx

**Files:**
- Modify: `apps/ui/src/App.tsx`

**Step 1: Import ThreadDetailPage and update route**

Replace the placeholder `/t/:threadId` route:

```typescript
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { Header } from "@/components/layout/Header";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import { WorkspaceDetailPage } from "@/pages/WorkspaceDetailPage";
import { ThreadDetailPage } from "@/pages/ThreadDetailPage";

function AppContent() {
  const { currentWorkspace, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {currentWorkspace ? <WorkspaceDetailPage /> : <WorkspaceListPage />}
      </main>
    </div>
  );
}

function ThreadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <ThreadDetailPage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/share" element={<div className="p-4">Share page - coming soon</div>} />
          <Route path="/t/:threadId" element={<ThreadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/ui/src/App.tsx
git commit -m "feat(ui): wire ThreadDetailPage to /t/:threadId route"
```

---

## Task 7: Add Thread Navigation to WorkspaceDetailPage

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceDetailPage.tsx`

**Step 1: Import useNavigate and add navigation to thread cards**

Add to imports:

```typescript
import { useNavigate } from "react-router-dom";
```

Add after `const { currentWorkspace } = useWorkspace();`:

```typescript
const navigate = useNavigate();
```

**Step 2: Update thread card click handler**

Find the thread card mapping section and update the Card's onClick:

```typescript
{threads.slice(0, 5).map((thread) => (
  <Card
    key={thread.id}
    onClick={() => navigate(`/t/${thread.id}`)}
    className="cursor-pointer hover:bg-accent/50 transition-colors"
  >
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/ui/src/pages/WorkspaceDetailPage.tsx
git commit -m "feat(ui): add thread navigation from workspace detail"
```

---

## Task 8: Update WorkspaceDetailPage to Use MessageInput

**Files:**
- Modify: `apps/ui/src/pages/WorkspaceDetailPage.tsx`

**Step 1: Import MessageInput and useSSE**

Replace the Input and related imports with:

```typescript
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { api, Thread } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch,
  GitCompare,
  Play,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
```

**Step 2: Add SSE state and handlers**

After the existing state declarations, add:

```typescript
const [currentRunId, setCurrentRunId] = useState<string | null>(null);
const [streamingContent, setStreamingContent] = useState("");

const handleChunk = useCallback((data: string) => {
  setStreamingContent((prev) => prev + data);
}, []);

const handleFinal = useCallback(() => {
  if (streamingContent) {
    setOutput((prev) => [...prev, streamingContent]);
    setStreamingContent("");
  }
  setCurrentRunId(null);
}, [streamingContent]);

useSSE(currentRunId, {
  onChunk: handleChunk,
  onFinal: handleFinal,
});
```

**Step 3: Update handleSendMessage to use API**

Replace the existing `handleSendMessage` function:

```typescript
const handleSendMessage = async (text: string) => {
  if (!currentWorkspace) return;

  setOutput((prev) => [...prev, `You: ${text}`]);

  // Get or create default thread
  let threadId = currentWorkspace.default_thread_id;
  if (!threadId) {
    try {
      const createResponse = await api.post<{ ok: boolean; thread_id: string }>("/threads/create");
      threadId = createResponse.thread_id;
    } catch (error) {
      setOutput((prev) => [...prev, `Error: Failed to create thread`]);
      return;
    }
  }

  try {
    const response = await api.post<{ run_id: string }>(
      `/threads/${threadId}/message`,
      { text, workspace_id: currentWorkspace.id }
    );
    setCurrentRunId(response.run_id);
  } catch (error) {
    setOutput((prev) => [...prev, `Error: ${error}`]);
  }
};
```

**Step 4: Replace the input area**

Replace the entire input div (the one with Input, Mic button, Send button) with:

```typescript
<div className="p-4 border-t border-border">
  <MessageInput
    onSend={handleSendMessage}
    disabled={!!currentRunId}
    placeholder="Type a message..."
  />
</div>
```

**Step 5: Show streaming content in output**

Update the output mapping to include streaming content at the end:

```typescript
<ScrollArea className="flex-1">
  <div className="p-4 font-mono text-sm space-y-2">
    {output.map((line, i) => (
      <div
        key={i}
        className={
          line.startsWith(">")
            ? "text-muted-foreground"
            : line.startsWith("You:")
              ? "text-primary"
              : line.startsWith("Error")
                ? "text-destructive"
                : "text-foreground whitespace-pre-wrap"
        }
      >
        {line}
      </div>
    ))}
    {streamingContent && (
      <div className="text-foreground whitespace-pre-wrap">
        {streamingContent}
        <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5" />
      </div>
    )}
  </div>
</ScrollArea>
```

**Step 6: Verify TypeScript compiles**

Run: `cd apps/ui && pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add apps/ui/src/pages/WorkspaceDetailPage.tsx
git commit -m "feat(ui): integrate SSE streaming and MessageInput in workspace detail"
```

---

## Task 9: Build and Verify

**Step 1: Run full build**

```bash
cd apps/ui && pnpm build
```

Expected: Build succeeds with no errors

**Step 2: Start dev server and test**

```bash
pnpm dev
```

Manual verification checklist:
- [ ] Navigate to workspace, see Main Thread section
- [ ] Type message and press Enter or click Send
- [ ] See "You: <message>" appear immediately
- [ ] See streaming response appear character by character
- [ ] Click on a thread card in Linked Threads
- [ ] See ThreadDetailPage load with message history
- [ ] Send message in thread view
- [ ] See streaming response
- [ ] Test mic button (if supported in browser)
- [ ] Click back arrow to return to workspace

**Step 3: Commit final verification**

```bash
git add -A
git commit -m "feat(ui): complete Phase 3 - threads with SSE streaming"
```

---

## Summary

Phase 3 adds:
- **Types:** `Message` and `ThreadDetail` for type-safe thread data
- **useSSE hook:** EventSource wrapper for real-time streaming
- **useDictation hook:** Web Speech API for voice input
- **MessageInput component:** Reusable input with mic and send buttons
- **ThreadDetailPage:** Full conversation view with streaming
- **Updated routing:** `/t/:threadId` now functional
- **Updated WorkspaceDetailPage:** Streaming in main thread area, navigation to threads
