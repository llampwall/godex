import { useState } from "react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ActionsMenu } from "./ActionsMenu";
import { NewRepoModal } from "@/components/workspace/NewRepoModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function Header() {
  const { currentWorkspace, refreshWorkspaces, setCurrentWorkspace } = useWorkspace();
  const [newRepoOpen, setNewRepoOpen] = useState(false);

  const handleRepoCreated = async (workspace: { id: string; title: string; repo_path: string }) => {
    await refreshWorkspaces();
    setCurrentWorkspace(workspace);
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex-1 min-w-0 mr-3">
          <WorkspaceSwitcher onNewRepo={() => setNewRepoOpen(true)} />
        </div>
        <div className="flex items-center gap-2">
          <ActionsMenu workspace={currentWorkspace} />
        </div>
      </header>

      <NewRepoModal
        open={newRepoOpen}
        onOpenChange={setNewRepoOpen}
        onCreated={handleRepoCreated}
      />
    </>
  );
}
