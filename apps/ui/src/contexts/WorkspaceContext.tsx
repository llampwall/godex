import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, Workspace } from "@/lib/api";

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const LAST_WORKSPACE_KEY = "godex_last_workspace";
const LAST_VISITED_KEY = "godex_last_visited";
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Synthetic global workspace for threads not attached to any workspace
export const GLOBAL_WORKSPACE: Workspace = {
  id: "__global__",
  title: "Unlinked Threads",
  repo_path: "Unlinked Threads",
  notify_policy: "none" as const,
  test_command_override: undefined,
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = async (): Promise<void> => {
    try {
      const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>("/workspaces");
      // Prepend global workspace for all threads
      setWorkspaces([GLOBAL_WORKSPACE, ...response.workspaces]);
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const setCurrentWorkspace = (workspace: Workspace | null) => {
    setCurrentWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem(LAST_WORKSPACE_KEY, workspace.id);
      localStorage.setItem(LAST_VISITED_KEY, Date.now().toString());
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      let data: Workspace[] = [];
      try {
        const response = await api.get<{ ok: boolean; workspaces: Workspace[] }>("/workspaces");
        data = response.workspaces;
        // Prepend global workspace for all threads
        setWorkspaces([GLOBAL_WORKSPACE, ...data]);
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
      }

      // Check for recent workspace
      const lastId = localStorage.getItem(LAST_WORKSPACE_KEY);
      const lastVisited = localStorage.getItem(LAST_VISITED_KEY);

      if (lastId && lastVisited) {
        const elapsed = Date.now() - parseInt(lastVisited, 10);
        if (elapsed < STALE_THRESHOLD_MS) {
          const workspace = data.find((w) => w.id === lastId);
          if (workspace) {
            setCurrentWorkspaceState(workspace);
          }
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        refreshWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
