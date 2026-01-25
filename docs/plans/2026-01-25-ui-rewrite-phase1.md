# UI Rewrite Phase 1: Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace vanilla TypeScript UI with React + shadcn/ui foundation, ready for views in Phase 2.

**Architecture:** Vite + React 18 with shadcn/ui components, Tailwind v4, react-router-dom for routing, context-based auth/workspace state.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, lucide-react, react-router-dom, clsx, tailwind-merge

---

## Task 1: Add React and Core Dependencies

**Files:**
- Modify: `apps/ui/package.json`

**Step 1: Update package.json with React dependencies**

Replace the entire `apps/ui/package.json` with:

```json
{
  "name": "godex-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-scroll-area": "^1.2.2",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^20.11.30",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "dotenv": "^16.4.5",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.2",
    "vite": "^5.4.7",
    "vite-plugin-pwa": "^0.20.5",
    "workbox-window": "^7.0.0"
  }
}
```

**Step 2: Install dependencies**

Run: `cd apps/ui && pnpm install`
Expected: Dependencies install successfully

**Step 3: Verify installation**

Run: `cd apps/ui && pnpm list react`
Expected: Shows react@18.x.x

**Step 4: Commit**

```bash
git add apps/ui/package.json apps/ui/pnpm-lock.yaml
git commit -m "feat(ui): add React and shadcn dependencies"
```

---

## Task 2: Configure Vite for React

**Files:**
- Modify: `apps/ui/vite.config.ts`

**Step 1: Update vite.config.ts**

Replace `apps/ui/vite.config.ts` with:

```typescript
import dotenv from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

dotenv.config({ path: "../../.env" });

const uiHost = process.env.UI_HOST?.trim() || "0.0.0.0";
const uiPort = Number(process.env.UI_PORT ?? 5174);

const manifest = {
  name: "godex",
  short_name: "godex",
  start_url: "/ui",
  scope: "/ui/",
  display: "standalone",
  background_color: "#000000",
  theme_color: "#000000",
  icons: [
    { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
    { src: "pwa-512.png", sizes: "512x512", type: "image/png" }
  ],
  share_target: {
    action: "/ui/share",
    method: "GET",
    enctype: "application/x-www-form-urlencoded",
    params: {
      title: "title",
      text: "text",
      url: "url"
    }
  }
};

export default defineConfig({
  base: "/ui/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest,
      includeAssets: ["godex.png", "pwa-192.png", "pwa-512.png"],
      manifestFilename: "manifest.webmanifest",
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/ui/index.html",
        navigateFallbackAllowlist: [/^\/ui\//]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: uiHost,
    port: uiPort,
    allowedHosts: ["central-command"]
  }
});
```

**Step 2: Verify config is valid**

Run: `cd apps/ui && pnpm vite --help`
Expected: No config errors

**Step 3: Commit**

```bash
git add apps/ui/vite.config.ts
git commit -m "feat(ui): configure Vite for React + Tailwind v4"
```

---

## Task 3: Set Up Tailwind CSS

**Files:**
- Create: `apps/ui/src/styles/globals.css`

**Step 1: Create globals.css with Tailwind v4 config**

Create `apps/ui/src/styles/globals.css`:

```css
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --radius: 0.625rem;
}

@theme inline {
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 2: Commit**

```bash
git add apps/ui/src/styles/globals.css
git commit -m "feat(ui): add Tailwind CSS globals with dark theme"
```

---

## Task 4: Create React Entry Point

**Files:**
- Create: `apps/ui/src/main.tsx`
- Modify: `apps/ui/index.html`
- Delete: `apps/ui/src/main.ts`

**Step 1: Create main.tsx**

Create `apps/ui/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/ui">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Step 2: Update index.html**

Replace `apps/ui/index.html` with:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#000000" />
    <link rel="icon" type="image/png" href="/ui/godex.png" />
    <link rel="apple-touch-icon" href="/ui/pwa-192.png" />
    <link rel="manifest" href="/ui/manifest.webmanifest" />
    <title>godex</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 3: Delete old main.ts**

Run: `rm apps/ui/src/main.ts`

**Step 4: Commit**

```bash
git add apps/ui/src/main.tsx apps/ui/index.html
git rm apps/ui/src/main.ts
git commit -m "feat(ui): create React entry point"
```

---

## Task 5: Create Utility Functions

**Files:**
- Create: `apps/ui/src/lib/utils.ts`

**Step 1: Create utils.ts**

Create `apps/ui/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2: Commit**

```bash
git add apps/ui/src/lib/utils.ts
git commit -m "feat(ui): add cn utility for class merging"
```

---

## Task 6: Port Core shadcn/ui Components

**Files:**
- Create: `apps/ui/src/components/ui/button.tsx`
- Create: `apps/ui/src/components/ui/input.tsx`
- Create: `apps/ui/src/components/ui/dropdown-menu.tsx`
- Create: `apps/ui/src/components/ui/dialog.tsx`
- Create: `apps/ui/src/components/ui/scroll-area.tsx`

**Step 1: Create button.tsx**

Create `apps/ui/src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**Step 2: Create input.tsx**

Create `apps/ui/src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

**Step 3: Create dropdown-menu.tsx**

Copy from `apps/ui/public/repo-main-page/components/ui/dropdown-menu.tsx` to `apps/ui/src/components/ui/dropdown-menu.tsx`.

Run: `cp apps/ui/public/repo-main-page/components/ui/dropdown-menu.tsx apps/ui/src/components/ui/dropdown-menu.tsx`

Then update the import path from `@/lib/utils` (already correct).

**Step 4: Create dialog.tsx**

Copy from `apps/ui/public/repo-main-page/components/ui/dialog.tsx` to `apps/ui/src/components/ui/dialog.tsx`.

Run: `cp apps/ui/public/repo-main-page/components/ui/dialog.tsx apps/ui/src/components/ui/dialog.tsx`

**Step 5: Create scroll-area.tsx**

Copy from `apps/ui/public/repo-main-page/components/ui/scroll-area.tsx` to `apps/ui/src/components/ui/scroll-area.tsx`.

Run: `cp apps/ui/public/repo-main-page/components/ui/scroll-area.tsx apps/ui/src/components/ui/scroll-area.tsx`

**Step 6: Commit**

```bash
git add apps/ui/src/components/ui/
git commit -m "feat(ui): add core shadcn/ui components"
```

---

## Task 7: Create API Client

**Files:**
- Create: `apps/ui/src/lib/api.ts`

**Step 1: Create api.ts**

Create `apps/ui/src/lib/api.ts`:

```typescript
const getBaseUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  const serverPort = params.get("serverPort");
  if (serverPort) {
    return `${window.location.protocol}//${window.location.hostname}:${serverPort}`;
  }
  return window.location.origin;
};

const getToken = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    localStorage.setItem("godex_token", urlToken);
    return urlToken;
  }
  return localStorage.getItem("godex_token");
};

export const api = {
  baseUrl: getBaseUrl(),
  token: getToken(),

  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  get<T>(path: string): Promise<T> {
    return this.fetch<T>(path, { method: "GET" });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string): Promise<T> {
    return this.fetch<T>(path, { method: "DELETE" });
  },
};

export type Workspace = {
  id: string;
  title: string;
  repo_path: string;
  notify_policy?: string;
  default_thread_id?: string;
  test_command_override?: string;
};

export type Thread = {
  id: string;
  title?: string;
  title_override?: string;
  pinned?: boolean;
  archived?: boolean;
  workspace_ids?: string[];
  last_message_preview?: string;
  updated_at?: string;
};
```

**Step 2: Commit**

```bash
git add apps/ui/src/lib/api.ts
git commit -m "feat(ui): add API client with types"
```

---

## Task 8: Create Auth Context

**Files:**
- Create: `apps/ui/src/contexts/AuthContext.tsx`

**Step 1: Create AuthContext.tsx**

Create `apps/ui/src/contexts/AuthContext.tsx`:

```tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      localStorage.setItem("godex_token", urlToken);
      setToken(urlToken);
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("token");
      window.history.replaceState({}, "", newUrl.toString());
    } else {
      const storedToken = localStorage.getItem("godex_token");
      setToken(storedToken);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add apps/ui/src/contexts/AuthContext.tsx
git commit -m "feat(ui): add auth context"
```

---

## Task 9: Create Workspace Context

**Files:**
- Create: `apps/ui/src/contexts/WorkspaceContext.tsx`

**Step 1: Create WorkspaceContext.tsx**

Create `apps/ui/src/contexts/WorkspaceContext.tsx`:

```tsx
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
```

**Step 2: Commit**

```bash
git add apps/ui/src/contexts/WorkspaceContext.tsx
git commit -m "feat(ui): add workspace context with smart default"
```

---

## Task 10: Create App Shell Header

**Files:**
- Create: `apps/ui/src/components/layout/Header.tsx`
- Create: `apps/ui/src/components/layout/WorkspaceSwitcher.tsx`
- Create: `apps/ui/src/components/layout/ActionsMenu.tsx`

**Step 1: Create Header.tsx**

Create `apps/ui/src/components/layout/Header.tsx`:

```tsx
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ActionsMenu } from "./ActionsMenu";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function Header() {
  const { currentWorkspace } = useWorkspace();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex-1 min-w-0 mr-3">
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <ActionsMenu workspace={currentWorkspace} />
      </div>
    </header>
  );
}
```

**Step 2: Create WorkspaceSwitcher.tsx**

Create `apps/ui/src/components/layout/WorkspaceSwitcher.tsx`:

```tsx
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface WorkspaceSwitcherProps {
  onNewRepo?: () => void;
}

export function WorkspaceSwitcher({ onNewRepo }: WorkspaceSwitcherProps) {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();

  const displayName = currentWorkspace?.repo_path || "godex";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1.5 text-foreground hover:bg-accent px-2 h-auto py-1 font-mono text-sm truncate max-w-full"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover border-border">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className={`cursor-pointer font-mono text-sm truncate ${
              currentWorkspace?.id === workspace.id ? "bg-accent" : ""
            }`}
          >
            {workspace.repo_path}
          </DropdownMenuItem>
        ))}
        {workspaces.length > 0 && <DropdownMenuSeparator className="bg-border" />}
        <DropdownMenuItem
          onClick={() => setCurrentWorkspace(null)}
          className="cursor-pointer"
        >
          All Workspaces
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={onNewRepo} className="cursor-pointer gap-2">
          <Plus className="w-4 h-4" />
          New Repository
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 3: Create ActionsMenu.tsx**

Create `apps/ui/src/components/layout/ActionsMenu.tsx`:

```tsx
import {
  MoreVertical,
  FolderOpen,
  Code2,
  MessageSquare,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, Workspace } from "@/lib/api";

interface ActionsMenuProps {
  workspace: Workspace | null;
}

export function ActionsMenu({ workspace }: ActionsMenuProps) {
  const handleOpenFolder = async () => {
    if (!workspace) return;
    await api.post(`/workspaces/${workspace.id}/open-folder`);
  };

  const handleOpenCode = async () => {
    if (!workspace) return;
    await api.post(`/workspaces/${workspace.id}/open-code`);
  };

  const handleRestart = async () => {
    await api.post("/diag/restart");
  };

  const handleDelete = async () => {
    if (!workspace) return;
    if (confirm(`Delete workspace "${workspace.title || workspace.repo_path}"?`)) {
      await api.delete(`/workspaces/${workspace.id}`);
      window.location.reload();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        {workspace && (
          <>
            <DropdownMenuItem onClick={handleOpenFolder} className="gap-2 cursor-pointer">
              <FolderOpen className="w-4 h-4" />
              Open folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenCode} className="gap-2 cursor-pointer">
              <Code2 className="w-4 h-4" />
              Open in VS Code
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <MessageSquare className="w-4 h-4" />
              Open default thread
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
          </>
        )}
        <DropdownMenuItem onClick={handleRestart} className="gap-2 cursor-pointer">
          <RefreshCw className="w-4 h-4" />
          Restart server
        </DropdownMenuItem>
        {workspace && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 4: Commit**

```bash
git add apps/ui/src/components/layout/
git commit -m "feat(ui): add app shell header components"
```

---

## Task 11: Create App Component with Routing

**Files:**
- Create: `apps/ui/src/App.tsx`
- Create: `apps/ui/src/pages/WorkspaceListPage.tsx`
- Create: `apps/ui/src/pages/WorkspaceDetailPage.tsx`

**Step 1: Create placeholder pages**

Create `apps/ui/src/pages/WorkspaceListPage.tsx`:

```tsx
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
```

Create `apps/ui/src/pages/WorkspaceDetailPage.tsx`:

```tsx
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
```

**Step 2: Create App.tsx**

Create `apps/ui/src/App.tsx`:

```tsx
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
```

**Step 3: Commit**

```bash
git add apps/ui/src/App.tsx apps/ui/src/pages/
git commit -m "feat(ui): add App with routing and placeholder pages"
```

---

## Task 12: Update TypeScript Config

**Files:**
- Modify: `apps/ui/tsconfig.json`

**Step 1: Update tsconfig.json**

Replace `apps/ui/tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 2: Commit**

```bash
git add apps/ui/tsconfig.json
git commit -m "feat(ui): update tsconfig for React with path aliases"
```

---

## Task 13: Verify Build

**Step 1: Run typecheck**

Run: `cd apps/ui && pnpm typecheck`
Expected: No type errors (or minor fixable errors)

**Step 2: Run build**

Run: `cd apps/ui && pnpm build`
Expected: Build succeeds, outputs to `dist/`

**Step 3: Fix any errors**

If errors occur, fix them and re-run.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(ui): resolve build errors"
```

---

## Task 14: Final Verification

**Step 1: Run dev server**

Run: `cd apps/ui && pnpm dev`
Expected: Vite dev server starts on configured port

**Step 2: Open in browser**

Open: `http://localhost:5174/ui?token=your-token`
Expected: See the app shell with header and workspace list

**Step 3: Verify workspace switching**

Click workspace switcher dropdown, verify workspaces appear (if any exist in backend).

**Step 4: Run full test suite**

Run: `pnpm test` (from repo root)
Expected: All server tests still pass, UI builds successfully

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(ui): complete Phase 1 foundation"
```

---

## Summary

After completing all tasks, you will have:

1. React 18 + Vite setup with TypeScript
2. Tailwind CSS v4 with dark theme
3. Core shadcn/ui components (Button, Input, DropdownMenu, Dialog, ScrollArea)
4. API client with auth handling
5. Auth and Workspace contexts
6. App shell with Header, WorkspaceSwitcher, ActionsMenu
7. Basic routing with placeholder pages
8. PWA config preserved from original

**Next:** Phase 2 will implement the full Workspace List, Workspace Detail (from mockup), and New Repo Modal.
