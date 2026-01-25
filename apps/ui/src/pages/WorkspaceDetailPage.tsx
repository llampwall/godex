import { useWorkspace } from "@/contexts/WorkspaceContext";

export function WorkspaceDetailPage() {
  const { currentWorkspace } = useWorkspace();

  if (!currentWorkspace) {
    return <div className="p-4 text-muted-foreground">No workspace selected</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">{currentWorkspace.title || currentWorkspace.repo_path}</h1>
      <p className="text-muted-foreground font-mono">{currentWorkspace.repo_path}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Workspace detail view - to be implemented in Phase 2
      </p>
    </div>
  );
}
