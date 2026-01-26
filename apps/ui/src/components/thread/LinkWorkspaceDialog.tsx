import { useState, useEffect } from "react";
import { api, Workspace } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface LinkWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
}

export function LinkWorkspaceDialog({ open, onOpenChange, threadId }: LinkWorkspaceDialogProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [linkedWorkspaceIds, setLinkedWorkspaceIds] = useState<string[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchWorkspaces();
      fetchLinkedWorkspaces();
    }
  }, [open, threadId]);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>("/workspaces");
      setWorkspaces(response.workspaces.filter(w => w.id !== "__global__"));
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchLinkedWorkspaces = async () => {
    try {
      const response = await api.get<{ data: { attached_workspace_ids: string[] } }>(
        `/threads/${threadId}`
      );
      setLinkedWorkspaceIds(response.data?.attached_workspace_ids || []);
    } catch (error) {
      console.error("Failed to fetch linked workspaces:", error);
    }
  };

  const handleLink = async () => {
    if (!selectedWorkspaceId) return;
    setLoading(true);
    try {
      await api.post(`/workspaces/${selectedWorkspaceId}/threads`, { thread_id: threadId });
      await fetchLinkedWorkspaces();
      setSelectedWorkspaceId("");
    } catch (error) {
      console.error("Failed to link workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (workspaceId: string) => {
    setLoading(true);
    try {
      await api.delete(`/workspaces/${workspaceId}/threads/${threadId}`);
      await fetchLinkedWorkspaces();
    } catch (error) {
      console.error("Failed to unlink workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const linkedWorkspaces = workspaces.filter(w => linkedWorkspaceIds.includes(w.id));
  const availableWorkspaces = workspaces.filter(w => !linkedWorkspaceIds.includes(w.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to Workspace</DialogTitle>
          <DialogDescription>
            Link this thread to one or more workspaces to organize your conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Currently Linked Workspaces */}
          {linkedWorkspaces.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Linked Workspaces</p>
              <div className="flex flex-wrap gap-2">
                {linkedWorkspaces.map(workspace => (
                  <div
                    key={workspace.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded text-sm"
                  >
                    <span className="font-mono">{workspace.repo_path}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => handleUnlink(workspace.id)}
                      disabled={loading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Workspace */}
          {availableWorkspaces.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Add Workspace</p>
              <div className="flex gap-2">
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a workspace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkspaces.map(workspace => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.repo_path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleLink} disabled={!selectedWorkspaceId || loading}>
                  Link
                </Button>
              </div>
            </div>
          )}

          {linkedWorkspaces.length === 0 && availableWorkspaces.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No workspaces available. Create a workspace first.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
