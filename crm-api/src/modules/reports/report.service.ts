import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const REFUND_TYPES = ['Refund khách hàng', 'Refund hãng tàu', 'Refund đại lý'];

export type RefundItem = {
  sheetId: number;
  sheetNumber: string;
  source: 'booking' | 'order';
  rowId: number;
  type: string;
  description: string | null;
  amount: number;
  date: string;
  customerId: number | null;
  customerName: string;
  carrierId: number | null;
  carrierName: string | null;
  agentId: number | null;
  agentName: string | null;
};

export type RefundGroup = {
  id: string | number | null;
  name: string;
  rowCount: number;
  sheetCount: number;
  totalAmount: number;
  items: RefundItem[];
};

const REFUND_ROWS = Prisma.sql`
  SELECT jb."sheetId", 'booking' AS source, jb.id AS "rowId", jb.type, jb.description,
    COALESCE(jb.total, jb."afterTaxAmount", jb."pretaxAmount", 0)::float8 AS amount,
    COALESCE(s."etaDate", s."createdAt"::date) AS d,
    s."sheetNumber", s."customerId",
    cu."companyName", cu."customerName"
  FROM job_bookings jb
  JOIN tracking_sheets s ON s.id = jb."sheetId"
  LEFT JOIN customers cu ON cu.id = s."customerId"
  WHERE jb."isDelete" = 1 AND jb.type IN (${Prisma.join(REFUND_TYPES.map((t) => Prisma.sql`${t}`))})
  UNION ALL
  SELECT jo."sheetId", 'order', jo.id, jo.type, jo.description,
    COALESCE(jo."portAmt", 0)::float8,
    COALESCE(s."etaDate", s."createdAt"::date),
    s."sheetNumber", s."customerId",
    cu."companyName", cu."customerName"
  FROM job_orders jo
  JOIN tracking_sheets s ON s.id = jo."sheetId"
  LEFT JOIN customers cu ON cu.id = s."customerId"
  WHERE jo."isDelete" = 1 AND jo.type IN (${Prisma.join(REFUND_TYPES.map((t) => Prisma.sql`${t}`))})
`;

// Hàm refundRangeCond: xử lý refundRangeCond
function refundRangeCond(from?: Date, to?: Date): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (from) conds.push(Prisma.sql`r.d >= ${from.toISOString().slice(0, 10)}::date`);
  if (to) conds.push(Prisma.sql`r.d <= ${to.toISOString().slice(0, 10)}::date`);
  if (conds.length === 0) return Prisma.empty;
  return Prisma.sql` AND ${Prisma.join(conds, ' AND ')}`;
}

interface RawRefundRow {
  sheetId: number;
  source: 'booking' | 'order';
  rowId: number;
  type: string;
  description: string | null;
  amount: number;
  d: Date | string;
  sheetNumber: string;
  customerId: number | null;
  companyName: string | null;
  customerName: string | null;
}

// Hàm mapRefundRow: xử lý mapRefundRow
function mapRefundRow(r: RawRefundRow): RefundItem {
  return {
    sheetId: Number(r.sheetId),
    sheetNumber: r.sheetNumber,
    source: r.source,
    rowId: Number(r.rowId),
    type: r.type,
    description: r.description,
    amount: Number(r.amount),
    date: new Date(r.d).toISOString(),
    customerId: r.customerId == null ? null : Number(r.customerId),
    customerName:
      r.customerId == null ? 'Chưa có khách hàng' : (r.companyName || r.customerName || '-'),
    carrierId: null,
    carrierName: null,
    agentId: null,
    agentName: null,
  };
}

// Hàm getRefundReport: xử lý getRefundReport
export async function getRefundReport(from?: Date, to?: Date, type?: string) {
  const range = refundRangeCond(from, to);
  const typeCond = type ? Prisma.sql` AND r.type = ${type}` : Prisma.empty;

  const [totals, customers, types] = await Promise.all([
    prisma.$queryRaw<Array<{ rowCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "rowCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${REFUND_ROWS}) r
      WHERE TRUE${range}${typeCond}
    `),
    prisma.$queryRaw<Array<{ id: number | null; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r."customerId" AS id,
        CASE WHEN r."customerId" IS NULL THEN N'Chưa có khách hàng'
             ELSE COALESCE(MAX(r."companyName"), MAX(r."customerName"), '-') END AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${REFUND_ROWS}) r
      WHERE TRUE${range}${typeCond}
      GROUP BY r."customerId"
      ORDER BY "totalAmount" DESC
    `),
    prisma.$queryRaw<Array<{ id: string; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r.type AS id,
        r.type AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${REFUND_ROWS}) r
      WHERE TRUE${range}${typeCond}
      GROUP BY r.type
      ORDER BY "totalAmount" DESC
    `),
  ]);

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totalAmount: totals[0]?.totalAmount ?? 0,
    rowCount: totals[0]?.rowCount ?? 0,
    customers: customers.map((g) => ({ ...g, items: [] })),
    types: types.map((g) => ({ ...g, items: [] })),
    carriers: [],
    agents: [],
  };
}

export type RefundDim = 'customer' | 'type';

// Hàm getRefundItems: xử lý getRefundItems
export async function getRefundItems(opts: {
  dim?: RefundDim;
  id?: string | number | null;
  type?: string;
  from?: Date;
  to?: Date;
  offset?: number;
  limit?: number;
}): Promise<{ rows: RefundItem[]; total: number }> {
  const range = refundRangeCond(opts.from, opts.to);
  const typeFilter = opts.type ? Prisma.sql` AND r.type = ${opts.type}` : Prisma.empty;
  let dimCond: Prisma.Sql = Prisma.empty;
  if (opts.dim === 'customer') {
    dimCond = opts.id == null ? Prisma.sql` AND r."customerId" IS NULL` : Prisma.sql` AND r."customerId" = ${opts.id as number}`;
  } else if (opts.dim === 'type') {
    dimCond = opts.id == null ? Prisma.sql` AND r.type IS NULL` : Prisma.sql` AND r.type = ${opts.id as string}`;
  }

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<RawRefundRow[]>(Prisma.sql`
      SELECT * FROM (${REFUND_ROWS}) r
      WHERE TRUE${range}${typeFilter}${dimCond}
      ORDER BY r.d ASC, r.source ASC, r."rowId" ASC
      LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}
    `),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM (${REFUND_ROWS}) r WHERE TRUE${range}${typeFilter}${dimCond}
    `),
  ]);
  return { rows: rows.map(mapRefundRow), total: counts[0]?.n ?? 0 };
}

export async function* iterateRefundItems(
  from: Date | undefined,
  to: Date | undefined,
  type?: string,
  batchSize = 20000,
): AsyncGenerator<RefundItem> {
  let offset = 0;
  for (;;) {
    const { rows } = await getRefundItems({ dim: 'customer', type, from, to, offset, limit: batchSize });
    for (const r of rows) yield r;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }
}

export type SheetCreationItem = {
  sheetId: number;
  sheetNumber: string;
  customerName: string;
  createdAt: string;
  etaDate: string | null;
};

export type SheetCreationGroup = {
  id: number | null;
  name: string;
  sheetCount: number;
  items: SheetCreationItem[];
};

// Hàm sheetCreatedCond: xử lý sheetCreatedCond
function sheetCreatedCond(from?: Date, to?: Date): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (from) conds.push(Prisma.sql`s."createdAt" >= ${from}`);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conds.push(Prisma.sql`s."createdAt" <= ${end}`);
  }
  if (conds.length === 0) return Prisma.empty;
  return Prisma.sql` AND ${Prisma.join(conds, ' AND ')}`;
}

// Hàm getSheetCreationReport: xử lý getSheetCreationReport
export async function getSheetCreationReport(from?: Date, to?: Date) {
  const cond = sheetCreatedCond(from, to);

  const [groups, totals] = await Promise.all([
    prisma.$queryRaw<Array<{ id: number | null; name: string; sheetCount: number }>>(Prisma.sql`
      SELECT u.id AS id, COALESCE(u."fullName", N'Chưa xác định') AS name, COUNT(*)::int AS "sheetCount"
      FROM tracking_sheets s
      LEFT JOIN users u ON u.id = s."createdById"
      WHERE s."isDelete" = 1${cond}
      GROUP BY u.id, u."fullName"
      ORDER BY "sheetCount" DESC
    `),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM tracking_sheets s WHERE s."isDelete" = 1${cond}
    `),
  ]);

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totalSheets: totals[0]?.n ?? 0,
    groups: groups.map((g) => ({ ...g, id: g.id == null ? null : Number(g.id), items: [] })),
  };
}

// Hàm getSheetCreationItems: xử lý getSheetCreationItems
export async function getSheetCreationItems(opts: {
  userId?: number | null;
  from?: Date;
  to?: Date;
  offset?: number;
  limit?: number;
}): Promise<{ rows: SheetCreationItem[]; total: number }> {
  const cond = sheetCreatedCond(opts.from, opts.to);
  let userCond: Prisma.Sql = Prisma.empty;
  if (opts.userId !== undefined) {
    userCond =
      opts.userId == null ? Prisma.sql` AND s."createdById" IS NULL` : Prisma.sql` AND s."createdById" = ${opts.userId}`;
  }

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<Array<{
      sheetId: number;
      sheetNumber: string;
      companyName: string | null;
      customerName: string | null;
      createdAt: Date;
      etaDate: Date | null;
    }>>(Prisma.sql`
      SELECT s.id AS "sheetId", s."sheetNumber",
        cu."companyName", cu."customerName", s."createdAt", s."etaDate"
      FROM tracking_sheets s
      LEFT JOIN customers cu ON cu.id = s."customerId"
      WHERE s."isDelete" = 1${cond}${userCond}
      ORDER BY s."createdAt" DESC, s.id DESC
      LIMIT ${opts.limit ?? 20} OFFSET ${opts.offset ?? 0}
    `),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM tracking_sheets s WHERE s."isDelete" = 1${cond}${userCond}
    `),
  ]);

  return {
    rows: rows.map((r) => ({
      sheetId: Number(r.sheetId),
      sheetNumber: r.sheetNumber,
      customerName: r.companyName || r.customerName || '-',
      createdAt: new Date(r.createdAt).toISOString(),
      etaDate: r.etaDate ? new Date(r.etaDate).toISOString() : null,
    })),
    total: counts[0]?.n ?? 0,
  };
}

export async function* iterateSheetItems(
  userId: number | null | undefined,
  from: Date | undefined,
  to: Date | undefined,
  batchSize = 20000,
): AsyncGenerator<SheetCreationItem> {
  let offset = 0;
  for (;;) {
    const { rows } = await getSheetCreationItems({ userId, from, to, offset, limit: batchSize });
    for (const r of rows) yield r;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }
}

// ============ THONG KE NANG HA ============

const LIFTING_PATTERN = `(description ILIKE ${'%nâng hạ%'} OR description ILIKE ${'%phí nâng%'} OR description ILIKE ${'%phí hạ%'})`;

const LIFTING_ROWS = Prisma.sql`
  SELECT jb."sheetId", 'booking' AS source, jb.id AS "rowId", jb.type, jb.description,
    COALESCE(jb.total, jb."afterTaxAmount", jb."pretaxAmount", 0)::float8 AS amount,
    COALESCE(s."etaDate", s."createdAt"::date) AS d,
    s."sheetNumber", s."customerId",
    cu."companyName", cu."customerName"
  FROM job_bookings jb
  JOIN tracking_sheets s ON s.id = jb."sheetId"
  LEFT JOIN customers cu ON cu.id = s."customerId"
  WHERE jb."isDelete" = 1 AND (jb.description ILIKE ${'%nâng hạ%'} OR jb.description ILIKE ${'%phí nâng%'} OR jb.description ILIKE ${'%phí hạ%'})
  UNION ALL
  SELECT jo."sheetId", 'order', jo.id, jo.type, jo.description,
    COALESCE(jo."portAmt", 0)::float8,
    COALESCE(s."etaDate", s."createdAt"::date),
    s."sheetNumber", s."customerId",
    cu."companyName", cu."customerName"
  FROM job_orders jo
  JOIN tracking_sheets s ON s.id = jo."sheetId"
  LEFT JOIN customers cu ON cu.id = s."customerId"
  WHERE jo."isDelete" = 1 AND (jo.description ILIKE ${'%nâng hạ%'} OR jo.description ILIKE ${'%phí nâng%'} OR jo.description ILIKE ${'%phí hạ%'})
`;

// ============ THONG KE DEBIT NOTE ============

const DEBIT_ROWS = Prisma.sql`
  SELECT dn.id AS "rowId", dn.type, dn.description, dn."invoiceNumber", dn."total"::float8 AS amount,
    COALESCE(s."etaDate", s."createdAt"::date) AS d,
    s.id AS "sheetId", s."sheetNumber", s."customerId",
    cu."companyName", cu."customerName",
    dn.currency, dn."quantity"::float8 AS quantity
  FROM debit_notes dn
  JOIN tracking_sheets s ON s.id = dn."sheetId"
  LEFT JOIN customers cu ON cu.id = s."customerId"
  WHERE dn."isDelete" = 1
`;

// Hàm getLiftingReport: xử lý getLiftingReport
export async function getLiftingReport(from?: Date, to?: Date) {
  const range = refundRangeCond(from, to);

  const [totals, customers, types] = await Promise.all([
    prisma.$queryRaw<Array<{ rowCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "rowCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${LIFTING_ROWS}) r
      WHERE TRUE${range}
    `),
    prisma.$queryRaw<Array<{ id: number | null; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r."customerId" AS id,
        CASE WHEN r."customerId" IS NULL THEN N'Chưa có khách hàng'
             ELSE COALESCE(MAX(r."companyName"), MAX(r."customerName"), '-') END AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${LIFTING_ROWS}) r
      WHERE TRUE${range}
      GROUP BY r."customerId"
      ORDER BY "totalAmount" DESC
    `),
    prisma.$queryRaw<Array<{ id: string; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r.type AS id,
        r.type AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${LIFTING_ROWS}) r
      WHERE TRUE${range}
      GROUP BY r.type
      ORDER BY "totalAmount" DESC
    `),
  ]);

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totalAmount: totals[0]?.totalAmount ?? 0,
    rowCount: totals[0]?.rowCount ?? 0,
    customers: customers.map((g) => ({ ...g, items: [] })),
    types: types.map((g) => ({ ...g, items: [] })),
    carriers: [],
    agents: [],
  };
}

// Hàm getLiftingItems: xử lý getLiftingItems
export async function getLiftingItems(opts: {
  dim?: RefundDim;
  id?: string | number | null;
  from?: Date;
  to?: Date;
  offset?: number;
  limit?: number;
}): Promise<{ rows: RefundItem[]; total: number }> {
  const range = refundRangeCond(opts.from, opts.to);
  let dimCond: Prisma.Sql = Prisma.empty;
  if (opts.dim === 'customer') {
    dimCond = opts.id == null ? Prisma.sql` AND r."customerId" IS NULL` : Prisma.sql` AND r."customerId" = ${opts.id as number}`;
  } else if (opts.dim === 'type') {
    dimCond = opts.id == null ? Prisma.sql` AND r.type IS NULL` : Prisma.sql` AND r.type = ${opts.id as string}`;
  }

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<RawRefundRow[]>(Prisma.sql`
      SELECT * FROM (${LIFTING_ROWS}) r
      WHERE TRUE${range}${dimCond}
      ORDER BY r.d ASC, r.source ASC, r."rowId" ASC
      LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}
    `),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM (${LIFTING_ROWS}) r WHERE TRUE${range}${dimCond}
    `),
  ]);
  return { rows: rows.map(mapRefundRow), total: counts[0]?.n ?? 0 };
}

export async function* iterateLiftingItems(
  from: Date | undefined,
  to: Date | undefined,
  batchSize = 20000,
): AsyncGenerator<RefundItem> {
  let offset = 0;
  for (;;) {
    const { rows } = await getLiftingItems({ dim: 'customer', from, to, offset, limit: batchSize });
    for (const r of rows) yield r;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }
}

export type DebitItem = {
  sheetId: number;
  sheetNumber: string;
  rowId: number;
  type: string;
  description: string | null;
  invoiceNumber: string | null;
  amount: number;
  quantity: number | null;
  currency: string | null;
  date: string;
  customerId: number | null;
  customerName: string;
};

export type DebitGroup = {
  id: string | number | null;
  name: string;
  rowCount: number;
  sheetCount: number;
  totalAmount: number;
  items: DebitItem[];
};

interface RawDebitRow {
  rowId: number;
  type: string;
  description: string | null;
  invoiceNumber: string | null;
  amount: number;
  quantity: number | null;
  currency: string | null;
  d: Date | string;
  sheetId: number;
  sheetNumber: string;
  customerId: number | null;
  companyName: string | null;
  customerName: string | null;
}

// Hàm mapDebitRow: xử lý mapDebitRow
function mapDebitRow(r: RawDebitRow): DebitItem {
  return {
    sheetId: Number(r.sheetId),
    sheetNumber: r.sheetNumber,
    rowId: Number(r.rowId),
    type: r.type,
    description: r.description,
    invoiceNumber: r.invoiceNumber,
    amount: Number(r.amount ?? 0),
    quantity: r.quantity == null ? null : Number(r.quantity),
    currency: r.currency,
    date: new Date(r.d).toISOString(),
    customerId: r.customerId == null ? null : Number(r.customerId),
    customerName: r.customerId == null ? 'Chưa có khách hàng' : (r.companyName || r.customerName || '-'),
  };
}

// Hàm getDebitReport: xử lý getDebitReport
export async function getDebitReport(from?: Date, to?: Date) {
  const range = refundRangeCond(from, to);
  const [totals, customers, types] = await Promise.all([
    prisma.$queryRaw<Array<{ rowCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "rowCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${DEBIT_ROWS}) r WHERE TRUE${range}
    `),
    prisma.$queryRaw<Array<{ id: number | null; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r."customerId" AS id,
        CASE WHEN r."customerId" IS NULL THEN N'Chưa có khách hàng'
             ELSE COALESCE(MAX(r."companyName"), MAX(r."customerName"), '-') END AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${DEBIT_ROWS}) r WHERE TRUE${range} GROUP BY r."customerId" ORDER BY "totalAmount" DESC
    `),
    prisma.$queryRaw<Array<{ id: string; name: string; rowCount: number; sheetCount: number; totalAmount: number }>>(Prisma.sql`
      SELECT r.type AS id, r.type AS name,
        COUNT(*)::int AS "rowCount",
        COUNT(DISTINCT r."sheetId")::int AS "sheetCount",
        ROUND(COALESCE(SUM(r.amount), 0)::numeric, 2)::float8 AS "totalAmount"
      FROM (${DEBIT_ROWS}) r WHERE TRUE${range} GROUP BY r.type ORDER BY "totalAmount" DESC
    `),
  ]);
  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totalAmount: totals[0]?.totalAmount ?? 0,
    rowCount: totals[0]?.rowCount ?? 0,
    customers: customers.map((g) => ({ ...g, items: [] })),
    types: types.map((g) => ({ ...g, items: [] })),
  };
}

// Hàm getDebitItems: xử lý getDebitItems
export async function getDebitItems(opts: {
  dim?: 'customer' | 'type';
  id?: string | number | null;
  from?: Date;
  to?: Date;
  offset?: number;
  limit?: number;
}): Promise<{ rows: DebitItem[]; total: number }> {
  const range = refundRangeCond(opts.from, opts.to);
  let dimCond: Prisma.Sql = Prisma.empty;
  if (opts.dim === 'customer') {
    dimCond = opts.id == null ? Prisma.sql` AND r."customerId" IS NULL` : Prisma.sql` AND r."customerId" = ${opts.id as number}`;
  } else if (opts.dim === 'type') {
    dimCond = opts.id == null ? Prisma.sql` AND r.type IS NULL` : Prisma.sql` AND r.type = ${opts.id as string}`;
  }
  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<RawDebitRow[]>(Prisma.sql`
      SELECT * FROM (${DEBIT_ROWS}) r WHERE TRUE${range}${dimCond}
      ORDER BY r.d ASC, r."rowId" ASC
      LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}
    `),
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS n FROM (${DEBIT_ROWS}) r WHERE TRUE${range}${dimCond}
    `),
  ]);
  return { rows: rows.map(mapDebitRow), total: counts[0]?.n ?? 0 };
}

export async function* iterateDebitItems(
  from: Date | undefined,
  to: Date | undefined,
  batchSize = 20000,
): AsyncGenerator<DebitItem> {
  let offset = 0;
  for (;;) {
    const { rows } = await getDebitItems({ dim: 'customer', from, to, offset, limit: batchSize });
    for (const r of rows) yield r;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }
}

// Hàm getDebitSheets: xử lý getDebitSheets
export async function getDebitSheets(opts: {
  search?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const { search, customerId, from, to, page = 1, pageSize = 20 } = opts;
  const where: any = { isDelete: 1, debitNotes: { some: { isDelete: 1 } } };
  const andConditions: any[] = [];
  if (search) {
    andConditions.push({
      OR: [
        { sheetNumber: { contains: search, mode: 'insensitive' } },
        { containerNumber: { contains: search, mode: 'insensitive' } },
        { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { customerName: { contains: search, mode: 'insensitive' } } } },
      ],
    });
  }
  if (customerId) andConditions.push({ customerId });
  if (from || to) {
    const dateCond: any = {};
    if (from) dateCond.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateCond.lte = end;
    }
    andConditions.push({
      OR: [{ etaDate: dateCond }, { AND: [{ etaDate: null }, { createdAt: dateCond }] }],
    });
  }
  if (andConditions.length) where.AND = andConditions;

  const [total, items] = await Promise.all([
    prisma.trackingSheet.count({ where }),
    prisma.trackingSheet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, customerName: true, companyName: true } },
        _count: { select: { debitNotes: { where: { isDelete: 1 } } } },
      },
    }),
  ]);

  // add debit summary per sheet
  const sheetIds = items.map((s) => s.id);
  const debitSums = sheetIds.length
    ? await prisma.debitNote.groupBy({
        by: ['sheetId'],
        where: { sheetId: { in: sheetIds }, isDelete: 1 },
        _count: { id: true },
        _sum: { total: true },
      })
    : [];
  const sumMap = new Map(debitSums.map((d) => [d.sheetId, d]));
  const enriched = items.map((s) => {
    const sum = sumMap.get(s.id);
    return {
      id: s.id,
      sheetNumber: s.sheetNumber,
      containerNumber: s.containerNumber,
      customer: s.customer,
      fromLocation: s.fromLocation,
      toLocation: s.toLocation,
      etaDate: s.etaDate,
      createdAt: s.createdAt,
      debitCount: sum?._count.id ?? 0,
      debitTotal: sum?._sum.total ? Number(sum._sum.total) : 0,
    };
  });

  return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// Hàm getLiftingSheets: xử lý getLiftingSheets
export async function getLiftingSheets(opts: {
  search?: string;
  customerId?: number;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const { search, customerId, from, to, page = 1, pageSize = 20 } = opts;
  const liftingDesc = { OR: [
    { description: { contains: 'nâng hạ', mode: 'insensitive' as const } },
    { description: { contains: 'phí nâng', mode: 'insensitive' as const } },
    { description: { contains: 'phí hạ', mode: 'insensitive' as const } },
  ]};
  const where: any = { isDelete: 1, OR: [{ jobOrders: { some: { isDelete: 1, ...liftingDesc } } }, { jobBookings: { some: { isDelete: 1, ...liftingDesc } } }] };
  const andConditions: any[] = [];
  if (search) {
    andConditions.push({
      OR: [
        { sheetNumber: { contains: search, mode: 'insensitive' } },
        { containerNumber: { contains: search, mode: 'insensitive' } },
        { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { customerName: { contains: search, mode: 'insensitive' } } } },
      ],
    });
  }
  if (customerId) andConditions.push({ customerId });
  if (from || to) {
    const dateCond: any = {};
    if (from) dateCond.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateCond.lte = end;
    }
    andConditions.push({
      OR: [{ etaDate: dateCond }, { AND: [{ etaDate: null }, { createdAt: dateCond }] }],
    });
  }
  if (andConditions.length) where.AND = andConditions;

  const [total, items] = await Promise.all([
    prisma.trackingSheet.count({ where }),
    prisma.trackingSheet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, customerName: true, companyName: true } },
      },
    }),
  ]);

  // lifting summary per sheet
  const sheetIds = items.map((s) => s.id);
  const liftingRows = sheetIds.length
    ? await prisma.$queryRaw<Array<{ sheetId: number; cnt: number; total: number }>>(Prisma.sql`
        SELECT s.id AS "sheetId", COUNT(*)::int AS cnt, COALESCE(SUM(
          COALESCE(jb.total, jb."afterTaxAmount", jb."pretaxAmount", jo."portAmt", 0)
        ), 0)::float8 AS total
        FROM tracking_sheets s
        LEFT JOIN job_bookings jb ON jb."sheetId" = s.id AND jb."isDelete" = 1 AND (jb.description ILIKE ${'%nâng hạ%'} OR jb.description ILIKE ${'%phí nâng%'} OR jb.description ILIKE ${'%phí hạ%'})
        LEFT JOIN job_orders jo ON jo."sheetId" = s.id AND jo."isDelete" = 1 AND (jo.description ILIKE ${'%nâng hạ%'} OR jo.description ILIKE ${'%phí nâng%'} OR jo.description ILIKE ${'%phí hạ%'})
        WHERE s.id IN (${Prisma.join(sheetIds)})
        GROUP BY s.id
      `)
    : [];
  const sumMap = new Map(liftingRows.map((d) => [Number(d.sheetId), d]));
  const enriched = items.map((s) => {
    const sum = sumMap.get(s.id);
    return {
      id: s.id,
      sheetNumber: s.sheetNumber,
      containerNumber: s.containerNumber,
      customer: s.customer,
      fromLocation: s.fromLocation,
      toLocation: s.toLocation,
      etaDate: s.etaDate,
      createdAt: s.createdAt,
      liftingCount: sum?.cnt ?? 0,
      liftingTotal: sum?.total ?? 0,
    };
  });

  return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============ BAO CAO LOI NHUAN ============

export type ProfitRow = {
  sheetId: number;
  sheetNumber: string;
  customerName: string;
  revenue: number;
  totalFees: number;
  cuocFees: number;
  serviceFees: number;
  profit: number;
  date: string;
};

// Hàm getProfitReport: xử lý getProfitReport
export async function getProfitReport(from?: Date, to?: Date) {
  const conds: Prisma.Sql[] = [];
  if (from) conds.push(Prisma.sql`s."etaDate" >= ${from.toISOString().slice(0, 10)}::date`);
  if (to) conds.push(Prisma.sql`s."etaDate" <= ${to.toISOString().slice(0, 10)}::date`);
  if (conds.length === 0) {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    conds.push(Prisma.sql`s."etaDate" >= ${yearStart.toISOString().slice(0, 10)}::date`);
  }
  const dateCond = Prisma.sql` AND ${Prisma.join(conds, ' AND ')}`;

  const CUOC_TYPES = ['Cược Cont', 'Cược sửa chữa cont'];

  const rows = await prisma.$queryRaw<Array<{
    sheetId: number;
    sheetNumber: string;
    customerName: string | null;
    companyName: string | null;
    revenue: number;
    totalFees: number;
    cuocFees: number;
    etaDate: Date | string | null;
    createdAt: Date;
  }>>(Prisma.sql`
    SELECT s.id AS "sheetId", s."sheetNumber",
      cu."customerName", cu."companyName",
      COALESCE(dn.rev, 0)::float8 AS revenue,
      (COALESCE(jb.total_fees, 0) + COALESCE(jo.order_fees, 0))::float8 AS "totalFees",
      (COALESCE(jb.cuoc_fees, 0) + COALESCE(jo.order_cuoc, 0))::float8 AS "cuocFees",
      s."etaDate", s."createdAt"
    FROM tracking_sheets s
    LEFT JOIN customers cu ON cu.id = s."customerId"
    LEFT JOIN (
      SELECT "sheetId", SUM("total") AS rev FROM debit_notes WHERE "isDelete" = 1 GROUP BY "sheetId"
    ) dn ON dn."sheetId" = s.id
    LEFT JOIN (
      SELECT "sheetId", SUM(COALESCE("pretaxAmount", 0)) AS total_fees,
        SUM(CASE WHEN type IN (${Prisma.join(CUOC_TYPES.map((t) => Prisma.sql`${t}`))}) THEN COALESCE("pretaxAmount", 0) ELSE 0 END) AS cuoc_fees
      FROM job_bookings WHERE "isDelete" = 1 GROUP BY "sheetId"
    ) jb ON jb."sheetId" = s.id
    LEFT JOIN (
      SELECT "sheetId", SUM(COALESCE("portAmt", 0)) AS order_fees,
        SUM(CASE WHEN type IN (${Prisma.join(CUOC_TYPES.map((t) => Prisma.sql`${t}`))}) THEN COALESCE("portAmt", 0) ELSE 0 END) AS order_cuoc
      FROM job_orders WHERE "isDelete" = 1 GROUP BY "sheetId"
    ) jo ON jo."sheetId" = s.id
    WHERE s."isDelete" = 1${dateCond}
    ORDER BY s."etaDate" ASC NULLS LAST, s."sheetNumber" ASC
  `);

  const items: ProfitRow[] = rows.map((r) => {
    const revenue = Number(r.revenue ?? 0);
    const totalFees = Number(r.totalFees ?? 0);
    const cuocFees = Number(r.cuocFees ?? 0);
    const serviceFees = totalFees - cuocFees;
    return {
      sheetId: Number(r.sheetId),
      sheetNumber: r.sheetNumber,
      customerName: r.companyName || r.customerName || '-',
      revenue,
      totalFees,
      cuocFees,
      serviceFees,
      profit: revenue - serviceFees,
      date: new Date(r.etaDate ?? r.createdAt).toISOString(),
    };
  });

  const totalRevenue = items.reduce((s, r) => s + r.revenue, 0);
  const totalServiceFees = items.reduce((s, r) => s + r.serviceFees, 0);
  const totalCuocFees = items.reduce((s, r) => s + r.cuocFees, 0);
  const totalProfit = items.reduce((s, r) => s + r.profit, 0);

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    items,
    totalSheets: items.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalServiceFees: Math.round(totalServiceFees * 100) / 100,
    totalCuocFees: Math.round(totalCuocFees * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
  };
}

// Hàm getDashboardStats: xử lý getDashboardStats
export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    totalCustomers,
    totalTrackingSheets,
    todaySheets,
    monthSheets,
    yearSheets,
    recentTrackingSheets,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null, isDelete: 1 } }),
    prisma.trackingSheet.count({ where: { isDelete: 1 } }),
    prisma.trackingSheet.count({
      where: { isDelete: 1, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.trackingSheet.count({
      where: { isDelete: 1, createdAt: { gte: monthStart } },
    }),
    prisma.trackingSheet.count({
      where: { isDelete: 1, createdAt: { gte: yearStart } },
    }),
    prisma.trackingSheet.findMany({
      where: { isDelete: 1 },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { companyName: true } } },
    }),
  ]);

  return {
    totalCustomers,
    totalTrackingSheets,
    todaySheets,
    monthSheets,
    yearSheets,
    recentTrackingSheets,
  };
}
