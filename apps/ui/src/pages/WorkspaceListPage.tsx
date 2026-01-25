import { useWorkspace } from "@/contexts/WorkspaceContext";

export function WorkspaceListPage() {
  const { workspaces, setCurrentWorkspace } = useWorkspace();

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Workspaces</h1>
      <div className="space-y-2">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className="p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="font-medium">{workspace.title || workspace.repo_path}</div>
            <div className="text-sm text-muted-foreground font-mono">{workspace.repo_path}</div>
          </div>
        ))}
        {workspaces.length === 0 && (
          <div className="text-muted-foreground">No workspaces yet. Create one to get started.</div>
        )}
      </div>
    </div>
  );
}
