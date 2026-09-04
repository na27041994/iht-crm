import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { auditLogger } from './middleware/audit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { customerRouter } from './modules/customers/customer.routes.js';
import { carrierRouter } from './modules/carriers/carrier.routes.js';
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
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(auditLogger);

ensureUploadDirs();
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/carriers', carrierRouter);
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
