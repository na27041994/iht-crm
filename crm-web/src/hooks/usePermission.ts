'use client';

import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;

    // Hàm fetchPermissions: xử lý fetchPermissions
    async function fetchPermissions() {
      try {
        setLoading(true);
        // Fetch role first to determine admin bypass
        const me = await apiFetch<MeResponse>('/auth/me');
        if (cancelled) return;
        const admin = me.role === 'admin';
        setIsAdmin(admin);

        const perms = await apiFetch<PermissionMap>('/permissions/me');
        if (cancelled) return;
        setPermissions(perms);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Không thể tải quyền';
        setError(message);
        setPermissions(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      if (isAdmin) return true;
      if (!permissions) return false;
      return permissions[resource]?.[action] ?? false;
    },
    [permissions, isAdmin],
  );

  return { permissions, loading, error, isAdmin, can };
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
