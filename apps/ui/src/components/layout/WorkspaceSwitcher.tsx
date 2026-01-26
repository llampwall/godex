import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, GLOBAL_WORKSPACE } from "@/contexts/WorkspaceContext";

interface WorkspaceSwitcherProps {
  onNewRepo?: () => void;
}

export function WorkspaceSwitcher({ onNewRepo }: WorkspaceSwitcherProps) {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();

  const displayName = currentWorkspace?.repo_path || "godex";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1.5 text-foreground hover:bg-accent px-2 h-auto py-1 font-mono text-sm truncate max-w-full"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover border-border">
        {workspaces.filter(w => w.id !== "__global__").map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className={`cursor-pointer font-mono text-sm truncate ${
              currentWorkspace?.id === workspace.id ? "bg-accent" : ""
            }`}
          >
            {workspace.repo_path}
          </DropdownMenuItem>
        ))}
        {workspaces.filter(w => w.id !== "__global__").length > 0 && (
          <DropdownMenuSeparator className="bg-border" />
        )}
        <DropdownMenuItem
          onClick={() => setCurrentWorkspace(null)}
          className="cursor-pointer"
        >
          All Workspaces
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setCurrentWorkspace(GLOBAL_WORKSPACE)}
          className={`cursor-pointer ${
            currentWorkspace?.id === "__global__" ? "bg-accent" : ""
          }`}
        >
          Unlinked Threads
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={onNewRepo} className="cursor-pointer gap-2">
          <Plus className="w-4 h-4" />
          New Repository
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
