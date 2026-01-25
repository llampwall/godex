import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { Header } from "@/components/layout/Header";
import { WorkspaceListPage } from "@/pages/WorkspaceListPage";
import { WorkspaceDetailPage } from "@/pages/WorkspaceDetailPage";

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
      <Header />
      <main className="flex-1">
        {currentWorkspace ? <WorkspaceDetailPage /> : <WorkspaceListPage />}
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
          <Route path="/share" element={<div className="p-4">Share page - coming soon</div>} />
          <Route path="/t/:threadId" element={<div className="p-4">Thread detail - coming soon</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
