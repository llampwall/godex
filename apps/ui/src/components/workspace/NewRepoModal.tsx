import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, Workspace } from "@/lib/api";
import {
  Globe,
  Server,
  Code2,
  Layers,
  FolderOpen,
  Sparkles,
  ChevronRight,
  Loader2,
} from "lucide-react";

const templates = [
  {
    id: "web-app",
    name: "Web App",
    description: "Next.js with React, TypeScript, and Tailwind CSS",
    icon: Globe,
  },
  {
    id: "web-service",
    name: "Web Service",
    description: "Express.js API with TypeScript and Node.js",
    icon: Server,
  },
  {
    id: "python",
    name: "Python",
    description: "Python with FastAPI and virtual environment",
    icon: Code2,
  },
  {
    id: "mono",
    name: "Monorepo",
    description: "Turborepo with shared packages and apps",
    icon: Layers,
  },
  {
    id: "empty",
    name: "Empty",
    description: "Start from scratch with a blank repository",
    icon: FolderOpen,
  },
];

interface NewRepoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (workspace: Workspace) => void;
}

export function NewRepoModal({ open, onOpenChange, onCreated }: NewRepoModalProps) {
  const [repoName, setRepoName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [useAIDescription, setUseAIDescription] = useState(false);
  const [aiDescription, setAIDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const payload = {
        title: repoName,
        repo_path: repoPath || `~/projects/${repoName}`,
        template: useAIDescription ? "ai-determined" : selectedTemplate,
        description: useAIDescription ? aiDescription : undefined,
      };

      const response = await api.post<{ ok: boolean; workspace: Workspace }>(
        "/workspaces",
        payload
      );

      if (response.workspace) {
        onCreated?.(response.workspace);
        onOpenChange(false);
        // Reset form
        setRepoName("");
        setRepoPath("");
        setSelectedTemplate(null);
        setUseAIDescription(false);
        setAIDescription("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  const isValid =
    repoName.trim() && (useAIDescription ? aiDescription.trim() : selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-foreground">
            Create a new repository
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Get started with a template or describe what you want to build
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Repo Name */}
          <div className="space-y-2">
            <Label htmlFor="repo-name" className="text-sm font-medium text-foreground">
              Repository name
            </Label>
            <Input
              id="repo-name"
              placeholder="my-awesome-project"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Optional Path */}
          <div className="space-y-2">
            <Label htmlFor="repo-path" className="text-sm font-medium text-foreground">
              Path <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="repo-path"
              placeholder="/path/to/repository"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Template Selection Toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseAIDescription(false)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  !useAIDescription
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Choose template
              </button>
              <button
                onClick={() => {
                  setUseAIDescription(true);
                  setSelectedTemplate(null);
                }}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
                  useAIDescription
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Describe your project
              </button>
            </div>

            {!useAIDescription ? (
              <div className="grid grid-cols-1 gap-2">
                {templates.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border transition-all text-left",
                        isSelected
                          ? "border-foreground bg-secondary"
                          : "border-border bg-input/50 hover:border-muted-foreground hover:bg-input"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
                          isSelected
                            ? "bg-foreground text-background"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{template.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {template.description}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-background"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Describe what you want to build and we'll pick the best template for you. E.g., 'A REST API for managing user authentication with PostgreSQL database' or 'A marketing website with blog and contact form'..."
                  value={aiDescription}
                  onChange={(e) => setAIDescription(e.target.value)}
                  className="min-h-[140px] bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  We'll analyze your description and choose the best template
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isCreating}
              className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create repository
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
