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
  'job_order',
  'job_booking',
  'debit_note',
] as const;
export type TrackingSheetSubResource = (typeof TRACKING_SHEET_SUB_RESOURCES)[number];

export const MASTER_DATA_RESOURCES = ['customer', 'trucker', 'agent'] as const;

export const RESOURCES = [
  'customer',
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
  trucker: 'Nhà xe',
  agent: 'Đại lý',
  tracking_sheet: 'Phiếu theo dõi',
  tracking_sheet_list: 'Phiếu theo dõi - Danh sách',
  tracking_sheet_import_history: 'Phiếu theo dõi - Lịch sử import',
  job_order: 'Phiếu theo dõi - Job Order',
  job_booking: 'Phiếu theo dõi - Job Book tàu',
  debit_note: 'Phiếu theo dõi - Debit Note',
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

export type PermissionMap = Record<Resource, Record<Action, boolean>>;

// Hàm defaultPermissionsForRole: xử lý defaultPermissionsForRole
export function defaultPermissionsForRole(role: string): PermissionMap {
  const allTrue: Record<Action, boolean> = { view: true, create: true, edit: true, delete: true };
  const viewOnly: Record<Action, boolean> = { view: true, create: false, edit: false, delete: false };
  const none: Record<Action, boolean> = { view: false, create: false, edit: false, delete: false };

  if (role === 'admin') {
    return {
      customer: { ...allTrue },
      trucker: { ...allTrue },
      agent: { ...allTrue },
      tracking_sheet: { ...allTrue },
      tracking_sheet_list: { ...allTrue },
      tracking_sheet_import_history: { ...allTrue },
      job_order: { ...allTrue },
      job_booking: { ...allTrue },
      debit_note: { ...allTrue },
      advance_voucher: { ...allTrue },
      report: { ...allTrue },
      report_profit: { ...allTrue },
      report_refund: { ...allTrue },
      report_sheet_creation: { ...allTrue },
      report_lifting: { ...allTrue },
      report_debit: { ...allTrue },
      role: { ...allTrue },
      user: { ...allTrue },
      audit_log: { ...allTrue },
    };
  }

  if (role === 'viewer') {
    return {
      customer: { ...viewOnly },
      trucker: { ...viewOnly },
      agent: { ...viewOnly },
      tracking_sheet: { ...viewOnly },
      tracking_sheet_list: { ...viewOnly },
      tracking_sheet_import_history: { ...viewOnly },
      job_order: { ...viewOnly },
      job_booking: { ...viewOnly },
      debit_note: { ...viewOnly },
      advance_voucher: { ...viewOnly },
      report: { ...viewOnly },
      report_profit: { ...viewOnly },
      report_refund: { ...viewOnly },
      report_sheet_creation: { ...viewOnly },
      report_lifting: { ...viewOnly },
      report_debit: { ...viewOnly },
      role: { ...none },
      user: { ...none },
      audit_log: { ...none },
    };
  }

  // sales / ops / accountant: default allow all except user/audit/role management
  return {
    customer: { ...allTrue },
    trucker: { ...allTrue },
    agent: { ...allTrue },
    tracking_sheet: { ...allTrue },
    tracking_sheet_list: { ...allTrue },
    tracking_sheet_import_history: { ...allTrue },
    job_order: { ...allTrue },
    job_booking: { ...allTrue },
    debit_note: { ...allTrue },
    advance_voucher: { ...allTrue },
    report: { ...allTrue },
    report_profit: { ...allTrue },
    report_refund: { ...allTrue },
    report_sheet_creation: { ...allTrue },
    report_lifting: { ...allTrue },
    report_debit: { ...allTrue },
    role: { ...none },
    user: { ...none },
    audit_log: { ...none },
  };
}

// Alias similar to backend naming — default permissions for generic non-admin role
export const defaultPermissions: PermissionMap = defaultPermissionsForRole('sales');
