import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { api, Thread } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch,
  GitCompare,
  Play,
  Send,
  Mic,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

export function WorkspaceDetailPage() {
  const { currentWorkspace } = useWorkspace();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to Godex. Type a message or use quick actions to get started.",
  ]);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchThreads = async () => {
      setLoadingThreads(true);
      try {
        const response = await api.get<{ ok: boolean; threads: Thread[] }>(
          `/threads?workspace_id=${currentWorkspace.id}`
        );
        setThreads(response.threads || []);
      } catch (error) {
        console.error("Failed to fetch threads:", error);
      } finally {
        setLoadingThreads(false);
      }
    };

    fetchThreads();
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return <div className="p-4 text-muted-foreground">No workspace selected</div>;
  }

  const handleQuickAction = async (action: "status" | "diff" | "test") => {
    setOutput((prev) => [...prev, `> Running git ${action}...`]);
    try {
      const endpoint =
        action === "test"
          ? `/workspaces/${currentWorkspace.id}/test`
          : `/workspaces/${currentWorkspace.id}/git/${action}`;
      const response = await api.post<{ ok: boolean; output?: string }>(endpoint);
      if (response.output) {
        setOutput((prev) => [...prev, response.output!]);
      }
    } catch (error) {
      setOutput((prev) => [...prev, `Error: ${error}`]);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setOutput((prev) => [...prev, `You: ${messageInput}`]);
    setMessageInput("");
    // TODO: Actually send message to thread in Phase 3
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <div className="flex-1 container max-w-5xl mx-auto p-6 flex flex-col gap-6 overflow-hidden">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction("status")}
            className="gap-2"
          >
            <GitBranch className="w-4 h-4" />
            git status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction("diff")}
            className="gap-2"
          >
            <GitCompare className="w-4 h-4" />
            git diff
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAction("test")}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            run tests
          </Button>
        </div>

        {/* Main Thread / Output Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-sm font-medium">Main Thread</CardTitle>
          </CardHeader>
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
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="shrink-0">
                <Mic className="w-4 h-4" />
              </Button>
              <Button onClick={handleSendMessage} size="icon" className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Linked Threads Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Linked Threads</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <Plus className="w-4 h-4" />
              Link thread
            </Button>
          </div>

          {loadingThreads ? (
            <div className="text-sm text-muted-foreground">Loading threads...</div>
          ) : threads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                No linked threads yet. Create one to start a conversation.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {threads.slice(0, 5).map((thread) => (
                <Card
                  key={thread.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {thread.title_override || thread.title || `Thread ${thread.id.slice(0, 8)}`}
                      </div>
                      {thread.last_message_preview && (
                        <div className="text-xs text-muted-foreground truncate">
                          {thread.last_message_preview}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
