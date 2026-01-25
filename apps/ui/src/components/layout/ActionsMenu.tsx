import {
  MoreVertical,
  FolderOpen,
  Code2,
  MessageSquare,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, Workspace } from "@/lib/api";

interface ActionsMenuProps {
  workspace: Workspace | null;
}

export function ActionsMenu({ workspace }: ActionsMenuProps) {
  const handleOpenFolder = async () => {
    if (!workspace) return;
    await api.post(`/workspaces/${workspace.id}/open-folder`);
  };

  const handleOpenCode = async () => {
    if (!workspace) return;
    await api.post(`/workspaces/${workspace.id}/open-code`);
  };

  const handleRestart = async () => {
    await api.post("/diag/restart");
  };

  const handleDelete = async () => {
    if (!workspace) return;
    if (confirm(`Delete workspace "${workspace.title || workspace.repo_path}"?`)) {
      await api.delete(`/workspaces/${workspace.id}`);
      window.location.reload();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        {workspace && (
          <>
            <DropdownMenuItem onClick={handleOpenFolder} className="gap-2 cursor-pointer">
              <FolderOpen className="w-4 h-4" />
              Open folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenCode} className="gap-2 cursor-pointer">
              <Code2 className="w-4 h-4" />
              Open in VS Code
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <MessageSquare className="w-4 h-4" />
              Open default thread
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
          </>
        )}
        <DropdownMenuItem onClick={handleRestart} className="gap-2 cursor-pointer">
          <RefreshCw className="w-4 h-4" />
          Restart server
        </DropdownMenuItem>
        {workspace && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
