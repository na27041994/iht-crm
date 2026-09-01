import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JOB_TYPES = ['Our Company Pay', 'Pay In Advance', 'Trucking Fee', 'Cược Cont', 'Cược sửa chữa cont', 'Refund khách hàng', 'Refund hãng tàu', 'Refund đại lý'];
const UNITS = ['Cont', 'Chuyến', 'CBM', 'KG', 'Lô'];
const DESCRIPTIONS = ['Phí nâng hạ', 'Local charges', 'Cước vận chuyển', 'Phí seal', 'Thủ tục hải quan', 'Phí lưu cont', 'Cước tàu', 'Phí xếp dỡ', 'Vận chuyển nội địa', 'Phí chứng từ'];
const INDUSTRIES = ['Cảng', 'Kho bãi', 'Vận tải', 'Đại lý', null];
const TAX_RATES = [0, 5, 8, 10];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const sheets = await prisma.trackingSheet.findMany({ select: { id: true } });
  if (!sheets.length) throw new Error('Chưa có phiếu theo dõi nào');
  const sheetIds = sheets.map((s) => s.id);

  const orders = [];
  for (let i = 0; i < 100; i++) {
    orders.push({
      sheetId: pick(sheetIds),
      type: pick(JOB_TYPES),
      description: pick(DESCRIPTIONS),
      portAmt: round2(rand(500, 50000) + Math.random()),
      industry: pick(INDUSTRIES),
      note: Math.random() < 0.3 ? `Ghi chú tự sinh #${i + 1}` : null,
    });
  }
  await prisma.jobOrder.createMany({ data: orders });

  const bookings = [];
  for (let i = 0; i < 100; i++) {
    const pretax = round2(rand(1000, 80000) + Math.random());
    const rate = pick(TAX_RATES);
    const tax = round2((pretax * rate) / 100);
    bookings.push({
      sheetId: pick(sheetIds),
      type: pick(JOB_TYPES),
      description: pick(DESCRIPTIONS),
      unit: pick(UNITS),
      quantity: rand(1, 50),
      pretaxAmount: pretax,
      taxRate: rate,
      taxAmount: tax,
      afterTaxAmount: round2(pretax + tax),
      total: round2(pretax + tax),
    });
  }
  await prisma.jobBooking.createMany({ data: bookings });

  const [o, b] = await Promise.all([prisma.jobOrder.count(), prisma.jobBooking.count()]);
  const bySheet = await prisma.trackingSheet.findMany({
    select: { id: true, sheetNumber: true, _count: { select: { jobOrders: true, jobBookings: true } } },
  });
  console.log(`Tổng: jobOrders=${o}, jobBookings=${b}`);
  for (const s of bySheet) {
    console.log(`Sheet #${s.id} ${s.sheetNumber}: ${s._count.jobOrders} job order, ${s._count.jobBookings} job book`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());