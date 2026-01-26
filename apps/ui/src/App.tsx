import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
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
  const { currentWorkspace, loading } = useWorkspace();

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
