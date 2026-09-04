// Các nhóm con để phân quyền chi tiết từng menu con (giữ parent để tương thích cũ)
export const REPORT_SUB_RESOURCES = [
  'report_profit',
  'report_refund',
  'report_sheet_creation',
  'report_lifting',
  'report_debit',
] as const;
export type ReportSubResource = (typeof REPORT_SUB_RESOURCES)[number];

export const TRACKING_SHEET_SUB_RESOURCES = [
  'tracking_sheet_list',
  'tracking_sheet_import_history',
] as const;
export type TrackingSheetSubResource = (typeof TRACKING_SHEET_SUB_RESOURCES)[number];

// Nhóm hiển thị Dữ liệu cơ bản (không có resource cha riêng, chỉ gom UI)
export const MASTER_DATA_RESOURCES = ['customer', 'carrier', 'trucker', 'agent'] as const;

// Tài nguyên quản lý vai trò
export const ROLE_RESOURCE = 'role' as const;

export const RESOURCES = [
  'customer',
  'carrier',
  'trucker',
  'agent',
  'tracking_sheet',
  ...TRACKING_SHEET_SUB_RESOURCES,
  'advance_voucher',
  'report',
  ...REPORT_SUB_RESOURCES,
  'role',
  'user',
  'audit_log',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

export type Action = (typeof ACTIONS)[number];

export const RESOURCE_LABELS: Record<Resource, string> = {
  customer: 'Khách hàng',
  carrier: 'Hãng tàu',
  trucker: 'Nhà xe',
  agent: 'Đại lý',
  tracking_sheet: 'Phiếu theo dõi',
  tracking_sheet_list: 'Phiếu theo dõi - Danh sách',
  tracking_sheet_import_history: 'Phiếu theo dõi - Lịch sử import',
  advance_voucher: 'Phiếu chi tạm ứng',
  report: 'Báo cáo',
  report_profit: 'Báo cáo - Lợi nhuận',
  report_refund: 'Báo cáo - Hoàn phí',
  report_sheet_creation: 'Báo cáo - Phiếu theo dõi',
  report_lifting: 'Báo cáo - Nâng hạ',
  report_debit: 'Báo cáo - Debit Note',
  role: 'Vai trò',
  user: 'Nhân viên',
  audit_log: 'Nhật ký hệ thống',
};
export const ACTION_LABELS: Record<Action, string> = {
  view: 'Xem',
  create: 'Thêm',
  edit: 'Sửa',
  delete: 'Xóa',
};

// Hàm defaultPermissionsForRole: xử lý defaultPermissionsForRole
export function defaultPermissionsForRole(role: string): Record<Resource, Record<Action, boolean>> {
  const allTrue = { view: true, create: true, edit: true, delete: true };
  const viewOnly = { view: true, create: false, edit: false, delete: false };
  const none = { view: false, create: false, edit: false, delete: false };

  if (role === 'admin') {
    return {
      customer: allTrue,
      carrier: allTrue,
      trucker: allTrue,
      agent: allTrue,
      tracking_sheet: allTrue,
      tracking_sheet_list: allTrue,
      tracking_sheet_import_history: allTrue,
      advance_voucher: allTrue,
      report: allTrue,
      report_profit: allTrue,
      report_refund: allTrue,
      report_sheet_creation: allTrue,
      report_lifting: allTrue,
      report_debit: allTrue,
      role: allTrue,
      user: allTrue,
      audit_log: allTrue,
    };
  }

  if (role === 'viewer') {
    return {
      customer: viewOnly,
      carrier: viewOnly,
      trucker: viewOnly,
      agent: viewOnly,
      tracking_sheet: viewOnly,
      tracking_sheet_list: viewOnly,
      tracking_sheet_import_history: viewOnly,
      advance_voucher: viewOnly,
      report: viewOnly,
      report_profit: viewOnly,
      report_refund: viewOnly,
      report_sheet_creation: viewOnly,
      report_lifting: viewOnly,
      report_debit: viewOnly,
      role: none,
      user: none,
      audit_log: none,
    };
  }

  // sales / ops / accountant: mặc định cho phép tất cả trừ quản lý user/audit/role
  return {
    customer: allTrue,
    carrier: allTrue,
    trucker: allTrue,
    agent: allTrue,
    tracking_sheet: allTrue,
    tracking_sheet_list: allTrue,
    tracking_sheet_import_history: allTrue,
    advance_voucher: allTrue,
    report: allTrue,
    report_profit: allTrue,
    report_refund: allTrue,
    report_sheet_creation: allTrue,
    report_lifting: allTrue,
    report_debit: allTrue,
    role: none,
    user: none,
    audit_log: none,
  };
}
