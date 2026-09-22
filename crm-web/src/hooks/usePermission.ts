'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Hook fetching effective permissions from GET /permissions/me.
 * Caches in state, handles loading/error, admin always returns true.
 */
// Hàm usePermissions: xử lý usePermissions
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionsState>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const lastFetchRef = useRef(0);

  // Hàm fetchPermissions: xử lý fetchPermissions
  const fetchPermissions = useCallback(async (cancelledRef?: { cancelled: boolean }) => {
    try {
      // Fetch role first to determine admin bypass
      const me = await apiFetch<MeResponse>('/auth/me');
      if (cancelledRef?.cancelled) return;
      const admin = me.role === 'admin';
      setIsAdmin(admin);

      const perms = await apiFetch<PermissionMap>('/permissions/me');
      if (cancelledRef?.cancelled) return;
      setPermissions(perms);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (err: unknown) {
      if (cancelledRef?.cancelled) return;
      const message = err instanceof Error ? err.message : 'Không thể tải quyền';
      setError(message);
      setPermissions(null);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchPermissions().finally(() => setLoading(false));
  }, [fetchPermissions]);

  useEffect(() => {
    const flag = { cancelled: false };
    setLoading(true);
    fetchPermissions(flag).finally(() => {
      if (!flag.cancelled) setLoading(false);
    });

    // Tự tải lại quyền khi quay lại tab (admin vừa phân quyền xong không cần đăng nhập lại),
    // throttle 60s để tránh spam API
    function onFocus() {
      if (Date.now() - lastFetchRef.current > 60000) {
        fetchPermissions(flag);
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') onFocus();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      flag.cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchPermissions]);

  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      if (isAdmin) return true;
      if (!permissions) return false;
      return permissions[resource]?.[action] ?? false;
    },
    [permissions, isAdmin],
  );

  return { permissions, loading, error, isAdmin, can, refresh };
}

/**
 * Convenience hook: returns boolean for a single resource/action.
 * Admin always returns true (bypass). Returns false while loading if not admin.
 */
// Hàm usePermission: xử lý usePermission
export function usePermission(resource: Resource, action: Action): boolean {
  const { can, loading, isAdmin } = usePermissions();
  // Admin bypass — true even while loading once role is known
  if (isAdmin) return true;
  if (loading) return false;
  return can(resource, action);
}

export default usePermission;
