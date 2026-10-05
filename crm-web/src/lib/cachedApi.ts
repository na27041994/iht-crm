import { apiFetch } from './api';

// Cache request dùng chung toàn app để cắt request lặp lại:
// - /auth/me: AppShell + mọi modal mở ra đều gọi lại
// - /auth/staff-options: mỗi lần mở modal phiếu chi/phiếu thu đều gọi lại
// Gọi clearApiCache() khi đăng xuất để user mới không dùng ké dữ liệu user cũ.

interface MeInfo {
  sub?: number;
  id?: number;
  role?: string;
  fullName?: string;
}

export interface StaffOption {
  id: number;
  fullName: string;
}

const ME_TTL_MS = 60000;
const STAFF_TTL_MS = 5 * 60000;

let meCache: MeInfo | null = null;
let meAt = 0;
let meInflight: Promise<MeInfo | null> | null = null;

let staffCache: StaffOption[] | null = null;
let staffAt = 0;
let staffInflight: Promise<StaffOption[]> | null = null;

// Hàm clearApiCache: xử lý clearApiCache (gọi khi đăng xuất)
export function clearApiCache() {
  meCache = null;
  meAt = 0;
  meInflight = null;
  staffCache = null;
  staffAt = 0;
  staffInflight = null;
}

// Hàm getMe: xử lý getMe (thông tin user đăng nhập, cache 60s)
export function getMe(): Promise<MeInfo | null> {
  if (meCache && Date.now() - meAt < ME_TTL_MS) return Promise.resolve(meCache);
  if (meInflight) return meInflight;
  meInflight = apiFetch<MeInfo>('/auth/me')
    .then((me) => {
      meCache = me;
      meAt = Date.now();
      return me;
    })
    .catch(() => meCache)
    .finally(() => {
      meInflight = null;
    });
  return meInflight;
}

// Hàm getMeId: xử lý getMeId (id user đăng nhập, tương thích cả {sub} lẫn {id})
export async function getMeId(): Promise<number | null> {
  const me = await getMe();
  if (!me) return null;
  const id = me.sub ?? me.id;
  return typeof id === 'number' ? id : null;
}

// Hàm getStaffOptions: xử lý getStaffOptions (danh sách nhân viên, cache 5 phút)
export function getStaffOptions(): Promise<StaffOption[]> {
  if (staffCache && Date.now() - staffAt < STAFF_TTL_MS) return Promise.resolve(staffCache);
  if (staffInflight) return staffInflight;
  staffInflight = apiFetch<StaffOption[]>('/auth/staff-options')
    .then((list) => {
      staffCache = Array.isArray(list) ? list : [];
      staffAt = Date.now();
      return staffCache;
    })
    .catch(() => staffCache ?? [])
    .finally(() => {
      staffInflight = null;
    });
  return staffInflight;
}
