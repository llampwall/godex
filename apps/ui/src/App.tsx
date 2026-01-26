import { Routes, Route, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { Header } from "@/components/layout/Header";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import { WorkspaceDetailPage } from "@/pages/WorkspaceDetailPage";
import { ThreadDetailPage } from "@/pages/ThreadDetailPage";
import { ShareDraftPage } from "@/pages/ShareDraftPage";

function AppContent() {
  const { currentWorkspace, workspaces, setCurrentWorkspace, loading } = useWorkspace();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Sync URL with workspace state
  useEffect(() => {
    if (loading) return;

    const workspaceParam = searchParams.get("workspace");

    if (workspaceParam) {
      // URL has workspace param - update current workspace if needed
      if (!currentWorkspace || currentWorkspace.id !== workspaceParam) {
        const workspace = workspaces.find(w => w.id === workspaceParam);
        if (workspace) {
          setCurrentWorkspace(workspace);
        } else {
          // Invalid workspace ID - clear param
          navigate("/", { replace: true });
        }
      }
    } else {
      // No workspace param - clear current workspace if set
      if (currentWorkspace) {
        setCurrentWorkspace(null);
      }
    }
  }, [searchParams, loading, workspaces]);

  // Update URL when workspace changes
  useEffect(() => {
    if (loading) return;

    const workspaceParam = searchParams.get("workspace");
    if (currentWorkspace && currentWorkspace.id !== workspaceParam) {
      navigate(`/?workspace=${currentWorkspace.id}`, { replace: true });
    } else if (!currentWorkspace && workspaceParam) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      <Header />
      <main className="flex-1">
        {currentWorkspace ? <WorkspaceDetailPage /> : <WorkspaceListPage />}
      </main>
    </div>
  );
}

function ThreadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner />
      <main className="flex-1">
        <ThreadDetailPage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/share" element={<ShareDraftPage />} />
          <Route path="/t/:threadId" element={<ThreadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
