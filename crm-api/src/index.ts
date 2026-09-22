import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { auditLogger } from './middleware/audit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { customerRouter } from './modules/customers/customer.routes.js';
import { truckerRouter } from './modules/truckers/trucker.routes.js';
import { agentRouter } from './modules/agents/agent.routes.js';
import { trackingSheetRouter } from './modules/tracking-sheets/trackingSheet.routes.js';
import { advanceVoucherRouter } from './modules/advance-vouchers/advanceVoucher.routes.js';
import { reportRouter } from './modules/reports/report.routes.js';
import { uploadRouter } from './modules/upload/upload.routes.js';
import { auditLogRouter } from './modules/audit-logs/auditLog.routes.js';
import { permissionsRouter } from './modules/permissions/permissions.routes.js';
import { roleRouter } from './modules/roles/role.routes.js';
import { ensureUploadDirs } from './modules/upload/upload.service.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Nén gzip responses JSON/Excel (giảm 70-90% payload danh sách, báo cáo, export)
app.use(compression({ threshold: 1024 }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(auditLogger);

ensureUploadDirs();
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d', etag: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/truckers', truckerRouter);
app.use('/api/agents', agentRouter);
app.use('/api/tracking-sheets', trackingSheetRouter);
app.use('/api/advance-vouchers', advanceVoucherRouter);
app.use('/api/reports', reportRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/roles', roleRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`CRM API đang chạy tại http://localhost:${env.port}`);
});
