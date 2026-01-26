import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent } from "@/components/ui/card";
import { Folder, Loader2 } from "lucide-react";

export function WorkspaceListPage() {
  const { workspaces, loading } = useWorkspace();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-muted-foreground mt-1">Select a workspace to get started</p>
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No workspaces yet.
              <br />
              Create one from the menu above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.map((workspace) => {
            const displayName = workspace.title || workspace.repo_path.split(/[/\\]/).pop() || workspace.repo_path;

            return (
              <Card
                key={workspace.id}
                onClick={() => navigate(`/?workspace=${workspace.id}`)}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                      <Folder className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {displayName}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono truncate mt-0.5">
                        {workspace.repo_path}
                      </p>
                      {workspace.notify_policy && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Notifications: {workspace.notify_policy}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
