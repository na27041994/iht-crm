import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {
      chineseName: '李翠红',
      cccd: '079199000001',
      phone: '0901111222',
      address: 'Q. Tân Bình, TP.HCM',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=admin',
    },
    create: {
      email: 'admin@crm.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      fullName: 'Quản trị hệ thống',
      chineseName: '李翠红',
      cccd: '079199000001',
      phone: '0901111222',
      address: 'Q. Tân Bình, TP.HCM',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=admin',
      role: UserRole.admin,
    },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@crm.com' },
    update: {
      chineseName: '陈文明',
      cccd: '079199000002',
      phone: '0903334444',
      address: 'Q. 7, TP.HCM',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=sales',
    },
    create: {
      email: 'sales@crm.com',
      passwordHash: await bcrypt.hash('sales123', 10),
      fullName: 'Nhân viên kinh doanh',
      chineseName: '陈文明',
      cccd: '079199000002',
      phone: '0903334444',
      address: 'Q. 7, TP.HCM',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=sales',
      role: UserRole.sales,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: 1 },
    update: {
      customerName: 'Công ty TNHH ABC Logistics',
      contactPerson: 'Trần Văn Minh',
      fax: '0243 823 4567',
    },
    create: {
      id: 1,
      customerName: 'Công ty TNHH ABC Logistics',
      companyName: 'Công ty TNHH ABC Logistics',
      contactPerson: 'Trần Văn Minh',
      taxCode: '0101234567',
      phone: '0901234567',
      fax: '0243 823 4567',
      email: 'contact@abc.com',
      address: 'Số 1, Đường Nguyễn Huệ, Quận 1, TP.HCM',
      country: 'Vietnam',
      createdById: admin.id,
    },
  });

  const carrier = await prisma.carrier.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      carrierName: 'Maersk Line',
      companyName: 'A.P. Moller - Maersk',
      address: 'Saigon Port, District 4, HCM',
      phone: '028 3822 8899',
      fax: '028 3822 8890',
      taxCode: '0311111111',
      contactPerson: 'Peter Jensen',
    },
  });

  await prisma.trucker.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      truckerName: 'Nhà xe Hải Vận',
      companyName: 'Công ty TNHH Vận tải Hải Vận',
      address: 'Gò Vấp, TP.HCM',
      phone: '028 7777 1234',
      fax: '028 7777 1235',
      taxCode: '0313333333',
      contactPerson: 'Nguyễn Văn Hải',
    },
  });

  await prisma.agent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      agentName: 'Đại lý Vạn Tường',
      companyName: 'Công ty TNHH Thương mại Vạn Tường',
      address: 'Quận 6, TP.HCM',
      phone: '028 6666 2345',
      fax: '028 6666 2346',
      taxCode: '0314444444',
      contactPerson: 'Trần Thị Lan',
    },
  });

  const sheet = await prisma.trackingSheet.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      sheetNumber: 'J260819-001',
      docStaffId: admin.id,
      deliveryStaffId: sales.id,
      nw: 22000,
      containerNumber: 'MSKU1234567',
      customerId: customer.id,
      fromLocation: 'Cat Lai Port, HCM',
      toLocation: 'Shanghai Port',
      containerQuantity: 1,
      etaDate: new Date('2026-09-01'),
      gw: 23000,
    },
  });

  await prisma.jobOrder.upsert({
    where: { id: 1 },
    update: {
      sheetId: sheet.id,
      type: 'Trucking Fee',
      description: 'Vận chuyển nội địa HCM - Cat Lai',
      portAmt: 3500000,
      industry: 'Gỗ',
      note: 'Thanh toán sau khi giao hàng',
    },
    create: {
      id: 1,
      sheetId: sheet.id,
      type: 'Trucking Fee',
      description: 'Vận chuyển nội địa HCM - Cat Lai',
      portAmt: 3500000,
      industry: 'Gỗ',
      note: 'Thanh toán sau khi giao hàng',
    },
  });

  await prisma.jobBooking.upsert({
    where: { id: 1 },
    update: {
      sheetId: sheet.id,
      type: 'Cược Cont',
      description: 'Cược container 40HC',
      unit: 'Cont',
      quantity: 1,
      pretaxAmount: 4000000,
      taxRate: 8,
      taxAmount: 320000,
      afterTaxAmount: 4320000,
      total: 4320000,
    },
    create: {
      id: 1,
      sheetId: sheet.id,
      type: 'Cược Cont',
      description: 'Cược container 40HC',
      unit: 'Cont',
      quantity: 1,
      pretaxAmount: 4000000,
      taxRate: 8,
      taxAmount: 320000,
      afterTaxAmount: 4320000,
      total: 4320000,
    },
  });

  await prisma.debitNote.upsert({
    where: { id: 1 },
    update: {
      sheetId: sheet.id,
      type: 'Our Company Pay',
      invoiceNumber: 'HD-2026-0088',
      description: 'Phí vận chuyển hàng xuất',
      unit: 'Cont',
      currency: 'USD',
      quantity: 1,
      priceVnd: null,
      taxRate: 8,
      priceUsd: 850,
      exchangeRate: 25400,
      total: 23317200,
    },
    create: {
      id: 1,
      sheetId: sheet.id,
      type: 'Our Company Pay',
      invoiceNumber: 'HD-2026-0088',
      description: 'Phí vận chuyển hàng xuất',
      unit: 'Cont',
      currency: 'USD',
      quantity: 1,
      priceVnd: null,
      taxRate: 8,
      priceUsd: 850,
      exchangeRate: 25400,
      total: 23317200,
    },
  });

  await prisma.advanceVoucher.upsert({
    where: { id: 1 },
    update: {
      sheetId: sheet.id,
      type: 'Chi tạm ứng',
      advanceDate: new Date('2026-08-19'),
      currency: 'VND',
      customerId: customer.id,
      orderFrom: 'HCM',
      orderTo: 'Cat Lai',
      containerQty: 1,
      qty: 1,
      note: 'Tạm ứng chi phí vận chuyển',
    },
    create: {
      id: 1,
      advanceNo: '260819001',
      sheetId: sheet.id,
      type: 'Chi tạm ứng',
      advanceDate: new Date('2026-08-19'),
      currency: 'VND',
      customerId: customer.id,
      orderFrom: 'HCM',
      orderTo: 'Cat Lai',
      containerQty: 1,
      qty: 1,
      note: 'Tạm ứng chi phí vận chuyển',
      createdById: admin.id,
    },
  });

  await prisma.advanceVoucherItem.upsert({
    where: { id: 1 },
    update: { amount: 2000000, note: 'Đặt cọc xe' },
    create: { id: 1, voucherId: 1, amount: 2000000, note: 'Đặt cọc xe' },
  });

  await prisma.advanceVoucherItem.upsert({
    where: { id: 2 },
    update: { amount: 1500000, note: 'Chi phí nâng cont' },
    create: { id: 2, voucherId: 1, amount: 1500000, note: 'Chi phí nâng cont' },
  });

  const tables = [
    'users', 'customers', 'contacts', 'carriers', 'truckers', 'agents',
    'quotes', 'quote_items', 'orders',
    'activities',
    'tracking_sheets', 'job_orders', 'job_bookings', 'debit_notes',
    'advance_vouchers', 'advance_voucher_items',
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${t}','id'), (SELECT COALESCE(MAX(id),1) FROM "${t}"))`,
    );
  }

  console.log('Seed hoàn tất: admin@crm.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());