import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = async () => {
    try {
      const data = await api.get<Workspace[]>("/workspaces");
      setWorkspaces(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      return [];
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
      const data = await refreshWorkspaces();

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
