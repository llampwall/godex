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
  thread_id: string;
  title?: string;
  title_override?: string;
  pinned?: boolean;
  archived?: boolean;
  attached_workspace_ids?: string[];
  summary?: string;
  updated_at?: string;
  last_seen_at?: string | null;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
};

export type ThreadDetail = {
  thread: Thread & {
    turns?: Array<{
      id: string;
      role?: string;
      content?: string;
      items?: Array<{
        id: string;
        type: string;
        role?: string;
        content?: string | Array<{ type: string; text?: string }>;
        text?: string;
      }>;
    }>;
    items?: Message[];
  };
  items?: Message[];
  turns?: Array<{
    id: string;
    role: string;
    content?: string;
    items?: Message[];
  }>;
  meta?: {
    thread_id: string;
    title_override?: string | null;
    pinned?: boolean;
    archived?: boolean;
    last_seen_at?: string;
  };
  attached_workspace_ids?: string[];
};
