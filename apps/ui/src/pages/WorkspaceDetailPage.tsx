import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { api, Thread } from "@/lib/api";
import { MessageInput } from "@/components/thread/MessageInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GitBranch,
  GitCompare,
  Play,
  Plus,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

export function WorkspaceDetailPage() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchThreads = async () => {
      setLoadingThreads(true);
      try {
        const url = `/threads?workspace_id=${currentWorkspace.id}`;
        const response = await api.get<{ data: Thread[] }>(url);
        setThreads(response.data || []);
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
    try {
      const endpoint =
        action === "test"
          ? `/workspaces/${currentWorkspace.id}/test`
          : `/workspaces/${currentWorkspace.id}/git/${action}`;
      await api.post<{ ok: boolean; output?: string }>(endpoint);
    } catch (error) {
      console.error(`Quick action ${action} failed:`, error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentWorkspace || isGlobalWorkspace) return;

    try {
      // Create a new thread
      const createResponse = await api.post<{ ok: boolean; thread_id: string }>("/threads/create", {});

      if (!createResponse.thread_id) {
        console.error("Failed to create thread");
        return;
      }

      const threadId = createResponse.thread_id;

      // Link the thread to this workspace
      await api.post(`/workspaces/${currentWorkspace.id}/threads`, { thread_id: threadId });

      // Send the message to the new thread
      const messageResponse = await api.post<{ run_id: string }>(
        `/threads/${threadId}/message`,
        { text, workspace_id: currentWorkspace.id }
      );

      // Navigate to the thread detail page with the run_id to continue streaming
      navigate(`/t/${threadId}?run_id=${messageResponse.run_id}`);
    } catch (error) {
      console.error("Failed to create thread or send message:", error);
    }
  };

  const isGlobalWorkspace = currentWorkspace.id === "__global__";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <div className="flex-1 container max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-hidden">
        {/* Quick Actions - only show for real workspaces, not global */}
        {!isGlobalWorkspace && (
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
        )}

        {/* New Thread Input - only show for real workspaces, not global */}
        {!isGlobalWorkspace && (
          <Card className="w-full">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm font-medium">New Thread</CardTitle>
            </CardHeader>
            <div className="p-4 border-t border-border">
              <MessageInput
                onSend={handleSendMessage}
                disabled={!!currentRunId}
                placeholder="Type a message to start a new thread..."
              />
            </div>
          </Card>
        )}

        {/* Global workspace message */}
        {isGlobalWorkspace && (
          <Card className="p-6 text-center border-dashed">
            <CardContent className="text-muted-foreground text-sm">
              These are threads not linked to any workspace. Click a thread to view it, or link it to a workspace from the thread page.
            </CardContent>
          </Card>
        )}

        {/* Threads Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">
              {isGlobalWorkspace ? "Unlinked Threads" : "Linked Threads"}
            </h2>
            {!isGlobalWorkspace && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <Plus className="w-4 h-4" />
                Link thread
              </Button>
            )}
          </div>

          {loadingThreads ? (
            <div className="text-sm text-muted-foreground">Loading threads...</div>
          ) : threads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                {isGlobalWorkspace
                  ? "No threads found."
                  : "No linked threads yet. Create one to start a conversation."}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {threads.slice(0, 5).map((thread) => (
                <Card
                  key={thread.thread_id}
                  onClick={() => navigate(`/t/${thread.thread_id}`)}
                  className="cursor-pointer hover:bg-accent/50 transition-colors w-full"
                >
                  <CardContent className="p-3 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="font-medium text-sm truncate">
                        {thread.title_override || thread.title || `Thread ${thread.thread_id.slice(0, 8)}`}
                      </div>
                      {thread.summary && (
                        <div className="text-xs text-muted-foreground truncate">
                          {thread.summary}
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
