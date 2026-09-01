import { getTokenClient } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Hàm resolveAssetUrl: xử lý resolveAssetUrl
export function resolveAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${API_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getTokenClient();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || 'Yêu cầu thất bại', res.status);
  }

  return res.json() as Promise<T>;
}

// Hàm apiDownload: xử lý apiDownload
export async function apiDownload(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getTokenClient();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers, credentials: 'include' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || 'Tải tệp thất bại', res.status);
  }

  return res.blob();
}

// Hàm saveBlob: xử lý saveBlob
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);

  const headers: Record<string, string> = {};
  const token = getTokenClient();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || 'Upload thất bại', res.status);
  }

  return res.json() as Promise<T>;
}
