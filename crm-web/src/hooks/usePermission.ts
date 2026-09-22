'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { apiFetch } from '@/lib/api';
import type { Resource, Action, PermissionMap } from '@/lib/permissions';

type PermissionsState = PermissionMap | null;

interface MeResponse {
  sub: number;
  role: string;
  fullName?: string;
}

export interface UsePermissionsReturn {
  permissions: PermissionsState;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  can: (resource: Resource, action: Action) => boolean;
  refresh: () => void;
}

// Cache dùng chung toàn app: mọi usePermissions/usePermission chỉ gây 1 lượt
// fetch (/auth/me + /permissions/me), các instance cùng subscribe kết quả.
interface SharedState {
  me: MeResponse | null;
  perms: PermissionMap | null;
  error: string | null;
  at: number;
}

const CACHE_TTL_MS = 60000;
let shared: SharedState = { me: null, perms: null, error: null, at: 0 };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
let focusBound = false;

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

function loadShared(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const me = await apiFetch<MeResponse>('/auth/me');
      const perms = await apiFetch<PermissionMap>('/permissions/me');
      shared = { me, perms, error: null, at: Date.now() };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải quyền';
      shared = { me: null, perms: null, error: message, at: Date.now() };
    } finally {
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

function refreshShared(): void {
  shared = { me: null, perms: null, error: null, at: 0 };
  void loadShared();
}

// Tự tải lại quyền khi quay lại tab (admin vừa phân quyền xong không cần đăng nhập lại)
function bindFocusReload() {
  if (focusBound || typeof window === 'undefined') return;
  focusBound = true;
  const onFocus = () => {
    if (Date.now() - shared.at > CACHE_TTL_MS) void loadShared();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') onFocus();
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
}

/**
 * Hook fetching effective permissions from GET /permissions/me.
 * Dùng cache chung nên gọi ở bao nhiêu component cũng chỉ tốn 1 lượt request.
 */
export function usePermissions(): UsePermissionsReturn {
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const listener = () => forceRender();
    listeners.add(listener);
    bindFocusReload();
    // Hết hạn hoặc chưa có thì tải (các instance cùng chờ 1 promise chung)
    if (!shared.perms && !shared.error && !inflight) void loadShared();
    else if (Date.now() - shared.at > CACHE_TTL_MS && !inflight) void loadShared();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const permissions = shared.perms;
  const error = shared.error;
  const isAdmin = shared.me?.role === 'admin';
  const loading = !permissions && !error;

  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      if (shared.me?.role === 'admin') return true;
      if (!shared.perms) return false;
      return shared.perms[resource]?.[action] ?? false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, isAdmin],
  );

  const refresh = useCallback(() => {
    refreshShared();
  }, []);

  return { permissions, loading, error, isAdmin: !!isAdmin, can, refresh };
}

/**
 * Convenience hook: returns boolean for a single resource/action.
 * Admin always returns true (bypass). Returns false while loading if not admin.
 */
export function usePermission(resource: Resource, action: Action): boolean {
  const { can, loading, isAdmin } = usePermissions();
  // Admin bypass — true even while loading once role is known
  if (isAdmin) return true;
  if (loading) return false;
  return can(resource, action);
}

export default usePermission;
