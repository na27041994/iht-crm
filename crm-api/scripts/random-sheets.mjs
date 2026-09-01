import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PREFIXES = ['MSKU', 'MSCU', 'HLCU', 'CMAU', 'COSU', 'ONEY', 'EMCU', 'TCLU'];
const PORTS = [
  'Cat Lai Port, HCM',
  'Cai Mep Port, BR-VT',
  'Hai Phong Port',
  'Da Nang Port',
  'Quy Nhon Port',
  'Shanghai Port',
  'Ningbo Port',
  'Shenzhen Port',
  'Qingdao Port',
  'Xiamen Port',
  'Singapore Port',
  'Laem Chabang Port',
  'Busan Port',
  'Kaohsiung Port',
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}
function chance(p) {
  return Math.random() < p;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const [customers, users] = await Promise.all([
    prisma.customer.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true } }),
  ]);
  const customerIds = customers.map((c) => c.id);
  const userIds = users.map((u) => u.id);

  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const existed = await prisma.trackingSheet.count({ where: { createdAt: { gte: start } } });

  function randDate(fromDays, toDays) {
    return new Date(now.getTime() + rand(fromDays, toDays) * 86400000);
  }

  const TOTAL = 200;
  const CHUNK = 50;

  for (let i = 1; i <= TOTAL; i++) {
    const prefix = pick(PREFIXES);
    const row = {
      sheetNumber: `J${y}${m}${d}-${String(existed + i).padStart(3, '0')}`,
      customerId: customerIds.length && !chance(0.1) ? pick(customerIds) : null,
      docStaffId: userIds.length ? pick(userIds) : null,
      deliveryStaffId: userIds.length ? pick(userIds) : null,
      containerNumber: `${prefix}${rand(1000000, 9999999)}`,
      containerQuantity: rand(1, 5),
      fromLocation: pick(PORTS),
      toLocation: pick(PORTS),
      pol: pick(PORTS),
      pod: pick(PORTS),
      nw: round2(rand(500, 25000) + Math.random()),
      gw: round2(rand(1000, 30000) + Math.random()),
      etaDate: randDate(-10, 30),
      declarationDate: chance(0.8) ? randDate(-15, 0) : null,
      customNo: chance(0.85) ? String(rand(1000000000, 9999999999)) : null,
      billNumber: `${prefix}${rand(100000000, 999999999)}`,
      invoiceNumber: chance(0.7) ? `INV-${now.getFullYear()}-${String(existed + i).padStart(4, '0')}` : null,
      note: chance(0.25) ? `Phiếu test tự sinh #${i}` : null,
    };
    await prisma.trackingSheet.create({ data: row });
    if (i % CHUNK === 0) console.log(`Đã tạo ${i}/${TOTAL}...`);
  }

  const total = await prisma.trackingSheet.count();
  const byCustomer = await prisma.trackingSheet.groupBy({ by: ['customerId'], _count: { _all: true } });
  console.log(`Hoàn tất. Tổng số phiếu theo dõi: ${total}`);
  console.log('Phân bố theo khách hàng:', JSON.stringify(byCustomer.map((g) => ({ customerId: g.customerId, count: g._count._all }))));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());