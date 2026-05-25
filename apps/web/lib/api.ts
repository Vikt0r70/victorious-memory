const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Memories ─────────────────────────────────────────
export const memoriesApi = {
  list: (params?: Record<string, string>) =>
    request<any>(`/memories?${new URLSearchParams(params)}`),
  get: (id: string) => request<any>(`/memories/${id}`),
  create: (data: any) =>
    request<any>("/memories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/memories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/memories/${id}`, { method: "DELETE" }),
  stats: (projectId?: string) =>
    request<any>(`/memories/stats${projectId ? `?project_id=${projectId}` : ""}`),
  search: (query: string, projectId?: string, topK = 10) =>
    request<any>("/memories/search", {
      method: "POST",
      body: JSON.stringify({ query, project_id: projectId, top_k: topK }),
    }),
  bulk: (action: string, ids: string[], reason?: string) =>
    request<any>("/memories/bulk", {
      method: "POST",
      body: JSON.stringify({ action, ids, reason }),
    }),
  approve: (id: string) =>
    request<any>(`/memories/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason?: string) =>
    request<any>(`/memories/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// ─── Projects ─────────────────────────────────────────
export const projectsApi = {
  list: () => request<any>("/projects"),
  get: (id: string) => request<any>(`/projects/${id}`),
  update: (id: string, data: any) =>
    request<any>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string, cascade = false) =>
    request<void>(`/projects/${id}?cascade=${cascade}`, { method: "DELETE" }),
  timeline: (id: string, limit = 50) =>
    request<any>(`/projects/${id}/timeline?limit=${limit}`),
};

// ─── Jobs ─────────────────────────────────────────────
export const jobsApi = {
  list: (params?: Record<string, string>) =>
    request<any>(`/jobs?${new URLSearchParams(params)}`),
  stats: () => request<any>("/jobs/stats"),
  retry: (id: string) =>
    request<any>(`/jobs/${id}/retry`, { method: "POST" }),
  retryAllFailed: () =>
    request<any>("/jobs/retry-all-failed", { method: "POST" }),
  cancel: (id: string) =>
    request<any>(`/jobs/${id}/cancel`, { method: "POST" }),
};

// ─── Exchanges ────────────────────────────────────────
export const exchangesApi = {
  list: (params?: Record<string, string>) =>
    request<any>(`/exchanges?${new URLSearchParams(params)}`),
  get: (id: string) => request<any>(`/exchanges/${id}`),
};

// ─── Graph / Edges ────────────────────────────────────
export const graphApi = {
  getGraph: (params?: Record<string, string>) =>
    request<any>(`/graph?${new URLSearchParams(params)}`),
  listEdges: (params?: Record<string, string>) =>
    request<any>(`/edges?${new URLSearchParams(params)}`),
  createEdge: (data: any) =>
    request<any>("/edges", { method: "POST", body: JSON.stringify(data) }),
  deleteEdge: (id: string) =>
    request<void>(`/edges/${id}`, { method: "DELETE" }),
};

// ─── Activity ─────────────────────────────────────────
export const activityApi = {
  list: (params?: Record<string, string>) =>
    request<any>(`/activity?${new URLSearchParams(params)}`),
};

// ─── Settings ─────────────────────────────────────────
export const settingsApi = {
  list: () => request<any>("/settings"),
  get: (key: string) => request<any>(`/settings/${key}`),
  set: (key: string, value: any) =>
    request<any>(`/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  delete: (key: string) =>
    request<void>(`/settings/${key}`, { method: "DELETE" }),
};

// ─── Providers ────────────────────────────────────────
export const providersApi = {
  list: () => request<any>("/providers"),
  create: (data: any) =>
    request<any>("/providers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/providers/${id}`, { method: "DELETE" }),
  test: (id: string) =>
    request<any>(`/providers/${id}/test`, { method: "POST" }),
  listModels: (id: string) => request<any>(`/providers/${id}/models`),
};

// ─── Agents ───────────────────────────────────────────
export const agentsApi = {
  list: () => request<any>("/agents"),
  update: (role: string, data: any) =>
    request<any>(`/agents/${role}`, { method: "PUT", body: JSON.stringify(data) }),
  test: (role: string) =>
    request<any>(`/agents/${role}/test`, { method: "POST" }),
};

// ─── Usage ────────────────────────────────────────────
export const usageApi = {
  list: (params?: Record<string, string>) =>
    request<any>(`/usage?${new URLSearchParams(params)}`),
};

// ─── System ───────────────────────────────────────────
export const systemApi = {
  info: () => request<any>("/system/info"),
  updateCheck: () => request<any>("/system/update-check"),
  reEmbed: () => request<any>("/system/re-embed", { method: "POST" }),
  purge: () =>
    request<any>("/system/purge?confirm=true", { method: "DELETE" }),
  export: () => request<any>("/system/export"),
};

// ─── Context ──────────────────────────────────────────
export const contextApi = {
  get: () => request<any>("/context"),
};
