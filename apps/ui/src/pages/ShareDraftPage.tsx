import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, X } from "lucide-react";

export function ShareDraftPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Parse incoming share data from URL params
  useEffect(() => {
    const sharedText = searchParams.get("text");
    const sharedUrl = searchParams.get("url");
    const sharedTitle = searchParams.get("title");

    if (sharedUrl) {
      setContent(sharedTitle ? `${sharedTitle}\n${sharedUrl}` : sharedUrl);
    } else if (sharedText) {
      setContent(sharedText);
    }
  }, [searchParams]);

  // Fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>(
          "/workspaces"
        );
        setWorkspaces(response.workspaces || []);
        if (response.workspaces.length > 0) {
          setSelectedWorkspaceId(response.workspaces[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, []);

  const handleSend = async () => {
    if (!content.trim() || !selectedWorkspaceId) return;

    setLoading(true);
    try {
      const workspace = workspaces.find((w) => w.id === selectedWorkspaceId);
      if (!workspace) return;

      // Get or create default thread
      let threadId = workspace.default_thread_id;
      if (!threadId) {
        const createResponse = await api.post<{ ok: boolean; thread_id: string }>(
          "/threads/create"
        );
        threadId = createResponse.thread_id;
      }

      // Send message to thread
      await api.post(`/threads/${threadId}/message`, {
        text: content,
        workspace_id: selectedWorkspaceId,
      });

      // Navigate to workspace
      navigate("/");
    } catch (error) {
      console.error("Failed to send share:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    navigate("/");
  };

  if (loadingWorkspaces) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Share to Godex</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Shared content will appear here..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="workspace">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.title ||
                      workspace.repo_path.split(/[/\\]/).pop() ||
                      workspace.repo_path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSend}
              disabled={loading || !content.trim() || !selectedWorkspaceId}
              className="flex-1 gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </Button>
            <Button
              onClick={handleDiscard}
              variant="outline"
              disabled={loading}
              className="flex-1 gap-2"
            >
              <X className="w-4 h-4" />
              Discard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
