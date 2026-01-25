import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ActionsMenu } from "./ActionsMenu";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function Header() {
  const { currentWorkspace } = useWorkspace();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex-1 min-w-0 mr-3">
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <ActionsMenu workspace={currentWorkspace} />
      </div>
    </header>
  );
}
