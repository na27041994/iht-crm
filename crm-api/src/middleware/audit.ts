import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from './auth.js';

const SUB_RESOURCES = new Set(['job-orders', 'job-bookings', 'debit-notes', 'items', 'contacts', 'users']);
const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'currentPassword', 'newPassword', 'token']);
const MAX_BODY_LENGTH = 2000;

const RESOURCE_LABELS: Record<string, string> = {
  'tracking-sheets': 'Phiếu theo dõi',
  'job-orders': 'Job Order',
  'job-bookings': 'Job Book tàu',
  'debit-notes': 'Debit Note',
  'advance-vouchers': 'Phiếu tạm ứng',
};

// Hàm deriveEntity: xử lý deriveEntity
function deriveEntity(urlPath: string): string {
  const segs = urlPath.split('?')[0].split('/').filter(Boolean);
  const named = segs.slice(1).filter((s) => !/^\d+$/.test(s));
  if (!named.length) return segs[1] ?? 'unknown';
  if (named.length >= 2 && SUB_RESOURCES.has(named[named.length - 1])) return named[named.length - 1];
  return named[0];
}

// Hàm deriveEntityId: xử lý deriveEntityId
function deriveEntityId(req: AuthedRequest, responseBody: unknown): string | null {
  if (req.params.id) return String(req.params.id);
  if (req.params.sheetId) return String(req.params.sheetId);
  if (
    responseBody &&
    typeof responseBody === 'object' &&
    'id' in responseBody &&
    (typeof (responseBody as { id: unknown }).id === 'number' || typeof (responseBody as { id: unknown }).id === 'string')
  ) {
    return String((responseBody as { id: unknown }).id);
  }
  const segs = req.originalUrl.split('?')[0].split('/').filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segs[i])) return segs[i];
  }
  return null;
}

// Hàm sanitizeBody: xử lý sanitizeBody
function sanitizeBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  try {
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(clone)) {
      if (SENSITIVE_KEYS.has(key)) clone[key] = '[REDACTED]';
    }
    const json = JSON.stringify(clone);
    return json.length > MAX_BODY_LENGTH ? json.slice(0, MAX_BODY_LENGTH) + '…' : json;
  } catch {
    return null;
  }
}

// Hàm resolveEntityCode: xử lý resolveEntityCode
async function resolveEntityCode(req: AuthedRequest, responseBody: unknown): Promise<string | null> {
  try {
    const segs = req.originalUrl.split('?')[0].split('/').filter(Boolean);
    const name = segs[1];
    const bodyId =
      responseBody && typeof responseBody === 'object' && 'id' in responseBody
        ? Number((responseBody as { id: unknown }).id)
        : NaN;
    // path id (sheet/voucher/record) takes priority over response id — for nested
    // resources like /tracking-sheets/:sheetId/job-orders the response id belongs
    // to the child table, not to the sheet whose code we want.
    const rawPathId = req.params.sheetId ?? req.params.voucherId ?? req.params.id ?? segs[2] ?? null;
    const recordId = rawPathId != null ? Number(rawPathId) : bodyId;
    if (!recordId || Number.isNaN(recordId)) return null;

    if (name === 'tracking-sheets') {
      const s = await prisma.trackingSheet.findUnique({
        where: { id: recordId },
        select: { sheetNumber: true },
      });
      return s?.sheetNumber ?? null;
    }
    if (name === 'advance-vouchers') {
      const v = await prisma.advanceVoucher.findUnique({
        where: { id: recordId },
        select: { advanceNo: true },
      });
      return v?.advanceNo ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

interface DeleteSnapshot {
  code: string | null;
  record: unknown;
}

// Load the full record BEFORE a DELETE handler removes it.
// NOTE: runs before routing, so req.params is empty — parse ids from the URL.
// Hàm loadDeleteSnapshot: xử lý loadDeleteSnapshot
async function loadDeleteSnapshot(req: AuthedRequest): Promise<DeleteSnapshot> {
  try {
    const segs = req.originalUrl.split('?')[0].split('/').filter(Boolean);
    const name = segs[1];

    if (name === 'tracking-sheets') {
      const sheetId = Number(segs[2]);
      const childType = segs[3];
      const childId = Number(segs[4]);

      if (
        (childType === 'job-orders' || childType === 'job-bookings' || childType === 'debit-notes') &&
        childId
      ) {
        let record: unknown = null;
        if (childType === 'job-orders') {
          record = await prisma.jobOrder.findUnique({ where: { id: childId } });
        } else if (childType === 'job-bookings') {
          record = await prisma.jobBooking.findUnique({ where: { id: childId } });
        } else {
          record = await prisma.debitNote.findUnique({ where: { id: childId } });
        }
        const sheet = await prisma.trackingSheet.findUnique({
          where: { id: sheetId },
          select: { sheetNumber: true },
        });
        return { code: sheet?.sheetNumber ?? null, record };
      }

      if (sheetId) {
        const record = await prisma.trackingSheet.findUnique({ where: { id: sheetId } });
        return { code: record?.sheetNumber ?? null, record };
      }
    }

    if (name === 'advance-vouchers') {
      const voucherId = Number(segs[2]);
      const itemId = Number(segs[4]);

      if (segs[3] === 'items' && itemId) {
        const item = await prisma.advanceVoucherItem.findUnique({ where: { id: itemId } });
        const voucher = await prisma.advanceVoucher.findUnique({
          where: { id: voucherId },
          select: { advanceNo: true },
        });
        return { code: voucher?.advanceNo ?? null, record: item };
      }
      if (voucherId) {
        const record = await prisma.advanceVoucher.findUnique({
          where: { id: voucherId },
          include: { items: true },
        });
        return { code: record?.advanceNo ?? null, record };
      }
    }
  } catch {
    // ignore
  }
  return { code: null, record: null };
}

// Hàm describeRecord: xử lý describeRecord
function describeRecord(entity: string, record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  // Hàm money: xử lý money
  const money = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? `${n.toLocaleString('vi-VN')}đ` : null;
  };
  switch (entity) {
    case 'job-orders':
      return [r.type, r.description].filter(Boolean).join(' – ') || null;
    case 'job-bookings':
      return [r.type, r.description, money(r.total)].filter(Boolean).join(' – ') || null;
    case 'debit-notes':
      return [r.type, r.description, r.invoiceNumber ? `HĐ ${r.invoiceNumber}` : null].filter(Boolean).join(' – ') || null;
    case 'tracking-sheets':
      return [r.containerNumber, r.fromLocation && r.toLocation ? `${String(r.fromLocation)} → ${String(r.toLocation)}` : null]
        .filter(Boolean)
        .join(' – ') || null;
    case 'advance-vouchers':
      return [r.type, r.note].filter(Boolean).join(' – ') || null;
    default:
      return null;
  }
}

// Hàm auditLogger: xử lý auditLogger
export function auditLogger(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  let responseBody: unknown;
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  // snapshot before DELETE handlers run (record will be gone afterwards)
  const deleteSnapshot =
    req.method === 'DELETE' ? loadDeleteSnapshot(req as AuthedRequest).catch(() => ({ code: null, record: null })) : null;

  res.on('finish', () => {
    try {
      const authed = req as AuthedRequest;
      const method = req.method;
      const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
      const isExport = method === 'GET' && /\/export$/.test(req.originalUrl.split('?')[0]);
      const isLogin = req.originalUrl.split('?')[0].endsWith('/auth/login');
      const isLogout = req.originalUrl.split('?')[0].endsWith('/auth/logout');
      if (!isMutation && !isExport && !isLogin && !isLogout) return;

      let action: string;
      let entity: string;
      if (isLogin) {
        action = res.statusCode < 400 ? 'LOGIN' : 'LOGIN_FAILED';
        entity = 'auth';
      } else if (isLogout) {
        action = 'LOGOUT';
        entity = 'auth';
      } else if (isExport) {
        action = 'EXPORT';
        entity = deriveEntity(req.originalUrl);
      } else {
        action = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
        entity = deriveEntity(req.originalUrl);
      }

      const userEmail =
        authed.user?.email ??
        (isLogin && req.body && typeof req.body === 'object' && 'email' in req.body
          ? String((req.body as { email: unknown }).email)
          : null);

      // Hàm writeLog: xử lý writeLog
      const writeLog = async () => {
        let userName = authed.user?.fullName ?? null;
        if (!userName && authed.user?.sub) {
          const u = await prisma.user.findUnique({
            where: { id: authed.user.sub },
            select: { fullName: true },
          });
          userName = u?.fullName ?? null;
        }

        let entityCode: string | null = null;
        let recordForDescription: unknown = null;
        let bodyJson: string | null = null;

        if (deleteSnapshot) {
          const snap = await deleteSnapshot;
          entityCode = snap.code;
          recordForDescription = snap.record;
          bodyJson = sanitizeBody(snap.record);
        } else if (isMutation) {
          entityCode = await resolveEntityCode(authed, responseBody);
          recordForDescription = responseBody;
          bodyJson = sanitizeBody(req.body);
        } else if (isExport) {
          entityCode = await resolveEntityCode(authed, undefined);
        }

        let description: string | null = null;
        if (isLogin) {
          description = res.statusCode < 400 ? 'Đăng nhập thành công' : 'Đăng nhập thất bại';
        } else if (isLogout) {
          description = 'Đăng xuất';
        } else if (isExport) {
          description = `Xuất Excel ${RESOURCE_LABELS[entity] ?? entity}`;
        } else {
          const verb = action === 'CREATE' ? 'Thêm' : action === 'UPDATE' ? 'Sửa' : 'Xóa';
          const label = RESOURCE_LABELS[entity];
          if (label) {
            const detail = describeRecord(entity, recordForDescription);
            description = `${verb} ${label}${detail ? `: ${detail}` : ''}`;
          }
        }

        await prisma.auditLog.create({
          data: {
            userId: authed.user?.sub ?? null,
            userEmail,
            userName,
            action,
            entity,
            entityId: deriveEntityId(authed, responseBody),
            entityCode,
            description,
            method,
            path: req.originalUrl.split('?')[0],
            statusCode: res.statusCode,
            ip: req.ip ?? null,
            userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
            bodyJson,
          },
        });
      };

      writeLog().catch(() => {});
    } catch {
      // never break the response because of logging
    }
  });

  next();
}