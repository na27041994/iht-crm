# CRM Logistics

Hệ thống CRM cho công ty logistics nhỏ — kiến trúc tách riêng **Frontend (Next.js)** và **Backend (Node.js/Express + Prisma + PostgreSQL)**.

```
crm-web/   → Frontend Next.js 15 (Port 3000)
crm-api/   → Backend Node.js Express + TypeScript (Port 5000)
```

## Yêu cầu

- Node.js >= 18
- PostgreSQL >= 14
- npm (khuyên dùng Node LTS v20+)

## 1. Khởi tạo Database

```bash
# Tạo database
createdb crm_logistics

# Tại thư mục crm-api
cp .env.example .env        # điền DATABASE_URL của bạn
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

Account mẫu sau khi seed: `admin@crm.com` / `admin123`

## 2. Chạy Backend

```bash
cd crm-api
npm run dev          # http://localhost:5000
```

Kiểm tra: `GET http://localhost:5000/health`

## 3. Chạy Frontend

```bash
cd crm-web
cp .env.example .env
npm install
npm run dev          # http://localhost:3000
```

Mở http://localhost:3000 → đăng nhập bằng tài khoản mẫu.

## API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập, trả JWT |
| GET | `/api/customers` | Danh sách khách hàng (phân trang + tìm kiếm) |
| POST | `/api/customers` | Tạo khách hàng |
| GET | `/api/customers/:id` | Chi tiết khách hàng |
| GET | `/api/leads` | Danh sách lead |
| PATCH | `/api/leads/:id/status` | Cập nhật trạng thái lead |
| POST | `/api/leads/:id/convert` | Chuyển lead → khách hàng |
| GET | `/api/shipments` | Danh sách lô hàng |
| POST | `/api/shipments` | Tạo lô hàng |
| PATCH | `/api/shipments/:id/status` | Cập nhật trạng thái + ghi tracking event |
| GET | `/api/reports/dashboard` | Thống kê dashboard |
| GET | `/api/reports/revenue` | Doanh thu theo tháng |
| GET | `/api/reports/pipeline` | Tổng hợp pipeline |

Mọi endpoint ngoài `/api/auth/login` đều cần header: `Authorization: Bearer <token>`

## Cấu trúc thư mục

```
crm-api/
  src/
    index.ts                  # Entry point Express
    config/env.ts             # Biến môi trường
    lib/                      # prisma singleton, jwt
    middleware/               # auth (JWT + RBAC), validate (Zod), error handler
    modules/
      auth/ customers/ leads/ shipments/ reports/
        *.routes.ts           # Định nghĩa endpoint
        *.service.ts          # Business logic + truy vấn Prisma
        *.schema.ts           # Zod validation
  prisma/
    schema.prisma             # Models
    seed.ts                   # Dữ liệu mẫu

crm-web/
  src/
    app/                      # App Router: login, dashboard, customers, leads, shipments, ...
    components/               # Sidebar, UI
    lib/                      # api client, auth (cookie JWT)
    middleware.ts             # Bảo vệ route theo token
```

## Role & phân quyền

| Role | Quyền |
|---|---|
| admin | Toàn quyền, quản lý user |
| sales | CRUD customers/leads, cập nhật status |
| ops | Quản lý shipments, cập nhật tracking |
| accountant | Quản lý hóa đơn/thanh toán |
| viewer | Chỉ xem |

## Lưu ý production

- Đổi `JWT_SECRET`, dùng HTTPS, set cookie `secure`
- Backup DB: `scripts/backup-db.ps1` hoặc pg_dump hàng ngày
- Nếu dữ liệu lớn: thêm Redis cho queue, materialized view cho báo cáo