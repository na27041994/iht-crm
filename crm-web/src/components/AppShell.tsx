'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Layout,
  Menu,
  Space,
  Typography,
  Avatar,
  Tooltip,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  DingdingOutlined,
  TruckOutlined,
  IdcardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  AccountBookOutlined,
  LogoutOutlined,
  RocketOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PieChartOutlined,
  DollarOutlined,
  HistoryOutlined,
  MoonOutlined,
  SunOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermission';
import { RESOURCE_LABELS } from '@/lib/permissions';
import type { Resource } from '@/lib/permissions';
import { useTheme } from '@/components/ThemeProvider';

interface NavItem {
  key: string;
  href?: string;
  label: string;
  icon?: React.ReactNode;
  children?: NavItem[];
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: '/dashboard', href: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
  {
    key: '/tracking-sheets',
    label: 'Phiếu theo dõi',
    icon: <FileSearchOutlined />,
    children: [
      { key: '/tracking-sheets', href: '/tracking-sheets', label: 'Danh sách phiếu' },
      { key: '/tracking-sheets/import-history', href: '/tracking-sheets/import-history', label: 'Lịch sử import', icon: <HistoryOutlined /> },
    ],
  },
  { key: '/advance-vouchers', href: '/advance-vouchers', label: 'Phiếu chi tạm ứng', icon: <AccountBookOutlined /> },
  {
    key: 'reports',
    label: 'Báo cáo',
    icon: <PieChartOutlined />,
    children: [
      { key: '/reports/profit', href: '/reports/profit', label: 'Lợi nhuận', icon: <DollarOutlined /> },
      { key: '/reports/refund', href: '/reports/refund', label: 'Hoàn phí', icon: <DollarOutlined /> },
      { key: '/reports/sheet-creation', href: '/reports/sheet-creation', label: 'Phiếu theo dõi', icon: <FileSearchOutlined /> },
      { key: '/reports/lifting', href: '/reports/lifting', label: 'Nâng hạ', icon: <TruckOutlined /> },
      { key: '/reports/advance-vouchers', href: '/reports/advance-vouchers', label: 'Phiếu bù/trả', icon: <AccountBookOutlined /> },
      { key: '/reports/debit', href: '/reports/debit', label: 'Debit Note', icon: <FileDoneOutlined /> },
    ],
  },
  {
    key: 'master-data',
    label: 'Dữ liệu cơ bản',
    icon: <DatabaseOutlined />,
    children: [
      { key: '/customers', href: '/customers', label: 'Khách hàng', icon: <TeamOutlined /> },
      { key: '/users', href: '/users', label: 'Nhân viên', icon: <RocketOutlined /> },
      { key: '/roles', href: '/roles', label: 'Vai trò', icon: <SafetyOutlined /> },
      { key: '/carriers', href: '/carriers', label: 'Hãng tàu', icon: <DingdingOutlined /> },
      { key: '/truckers', href: '/truckers', label: 'Nhà xe', icon: <TruckOutlined /> },
      { key: '/agents', href: '/agents', label: 'Đại lý', icon: <IdcardOutlined /> },
    ],
  },
  { key: '/audit-logs', href: '/audit-logs', label: 'Nhật ký hệ thống', icon: <FileDoneOutlined />, adminOnly: true },
];

const { Sider, Content, Header } = Layout;

// Ánh xạ href sang resource để lọc menu theo quyền
function getResourceForHref(href: string): Resource | null {
  if (href.startsWith('/customers')) return 'customer';
  if (href.startsWith('/carriers')) return 'carrier';
  if (href.startsWith('/truckers')) return 'trucker';
  if (href.startsWith('/agents')) return 'agent';
  if (href.startsWith('/roles')) return 'role';
  if (href.startsWith('/tracking-sheets/import-history')) return 'tracking_sheet_import_history';
  if (href.startsWith('/tracking-sheets')) return 'tracking_sheet_list';
  if (href.startsWith('/advance-vouchers')) return 'advance_voucher';
  if (href.startsWith('/reports/profit')) return 'report_profit';
  if (href.startsWith('/reports/refund')) return 'report_refund';
  if (href.startsWith('/reports/sheet-creation')) return 'report_sheet_creation';
  if (href.startsWith('/reports/lifting')) return 'report_lifting';
  if (href.startsWith('/reports/debit')) return 'report_debit';
  if (href.startsWith('/reports/advance-vouchers')) return 'advance_voucher';
  if (href.startsWith('/reports')) return 'report';
  if (href.startsWith('/users')) return 'user';
  if (href.startsWith('/audit-logs')) return 'audit_log';
  return null;
}

// Hàm MenuContent: xử lý MenuContent
function MenuContent({
  pathname,
  onNavigate,
  me,
  onLogout,
  collapsed,
  onToggle,
}: {
  pathname: string;
  onNavigate: (href: string) => void;
  me: { fullName?: string; role?: string } | null;
  onLogout: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { can, loading } = usePermissions();
  const { isDark, toggle } = useTheme();

  // Keep existing adminOnly logic as fallback, but also check permission view.
  // If loading is true, show all (skeleton behaviour) to avoid flicker.
  // Admin bypass is handled inside can() (isAdmin -> true).
  // Hàm visibleNav: xử lý visibleNav
  const visibleNav = (() => {
    const base = NAV.filter((item) => !item.adminOnly || me?.role === 'admin');
    if (loading) return base;
    const filtered = base
      .map((item) => {
        if (item.children) {
          const filteredChildren = item.children.filter((child) => {
            if (child.adminOnly && me?.role !== 'admin') return false;
            const href = child.href ?? child.key;
            const resource = getResourceForHref(href);
            if (!resource) return true;
            // RESOURCE_LABELS imported to ensure resource keys stay in sync with permissions lib
            void RESOURCE_LABELS[resource];
            return can(resource, 'view');
          });
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        const href = item.href ?? item.key;
        const resource = getResourceForHref(href);
        if (!resource) return item;
        void RESOURCE_LABELS[resource];
        if (!can(resource, 'view')) return null;
        return item;
      })
      .filter((v): v is NavItem => v !== null);
    return filtered;
  })();

  const flatNav = visibleNav.flatMap((item) => (item.children ? item.children : [item]));
  const selectedKey =
    flatNav.find((item) => pathname === item.href || pathname.startsWith((item.href ?? '') + '/'))?.key ??
    '/dashboard';

  const [openKeys, setOpenKeys] = useState<string[]>(['master-data']);
  const parentKey = visibleNav.find((item) =>
    item.children?.some((c) => pathname === c.href || pathname.startsWith((c.href ?? '') + '/')),
  )?.key;

  useEffect(() => {
    if (parentKey) setOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
  }, [parentKey]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-16 items-center gap-2 border-b px-5 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        style={collapsed ? { justifyContent: 'center', padding: '0 4px' } : undefined}
      >
        {!collapsed && <RocketOutlined style={{ fontSize: 20, color: '#2563eb' }} />}
        {!collapsed && (
          <Typography.Title
            level={5}
            style={{ margin: 0, color: isDark ? '#fff' : '#1d4ed8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}
          >
            I.H.T Logistics
          </Typography.Title>
        )}
        <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
          <Button type="text" aria-label="Đổi chế độ" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
        </Tooltip>
        {onToggle && (
          <Button
            type="text"
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggle}
          />
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={visibleNav.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: item.label,
          children: item.children?.map((child) => ({
            key: child.key,
            icon: child.icon,
            label: child.label,
          })),
        }))}
        onClick={({ key }) => onNavigate(key)}
        style={{ borderInlineEnd: 'none' }}
      />

      <div className={`border-t p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`} style={{ marginTop: 'auto' }}>
        {collapsed ? (
          <Space direction="vertical" size={12} style={{ width: '100%', alignItems: 'center' }}>
            <Avatar size="small" style={{ backgroundColor: '#2563eb' }}>
              {me?.fullName?.[0] ?? '?'}
            </Avatar>
            <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
              <Button icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
            </Tooltip>
            <Tooltip title="Đăng xuất">
              <Button icon={<LogoutOutlined />} onClick={onLogout} />
            </Tooltip>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={8} className="px-1">
              <Avatar size="small" style={{ backgroundColor: '#2563eb' }}>
                {me?.fullName?.[0] ?? '?'}
              </Avatar>
              <Typography.Text ellipsis style={{ maxWidth: 130 }}>
                {me?.fullName ?? 'Đang tải...'}
              </Typography.Text>
            </Space>
            <Space size={8} style={{ width: '100%' }}>
              <Button icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} style={{ flex: 1 }}>
                {isDark ? 'Sáng' : 'Tối'}
              </Button>
              <Button icon={<LogoutOutlined />} onClick={onLogout} style={{ flex: 1 }}>
                Đăng xuất
              </Button>
            </Space>
          </Space>
        )}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ fullName?: string; role?: string } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { isDark, toggle } = useTheme();

  useEffect(() => {
    apiFetch<{ sub: number; role: string; fullName?: string }>('/auth/me')
      .then((d) => setMe({ fullName: d.fullName, role: d.role }))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Hàm handleLogout: xử lý handleLogout
  function handleLogout() {
    setDrawerOpen(false);
    clearToken();
    router.push('/login');
    router.refresh();
  }

  // Hàm navigate: xử lý navigate
  function navigate(href: string) {
    router.push(href);
  }

  return (
    <Layout style={{ minHeight: '100vh', background: isDark ? '#141414' : '#f5f5f5' }}>
      <Sider
        theme={isDark ? 'dark' : 'light'}
        width={232}
        collapsed={collapsed}
        collapsedWidth={80}
        breakpoint="lg"
        onBreakpoint={(broken) => setMobile(broken)}
        trigger={null}
        style={{
          borderRight: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
          position: mobile ? 'fixed' : 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          display: mobile ? 'none' : 'block',
          overflow: 'auto',
        }}
      >
        <MenuContent
          pathname={pathname}
          onNavigate={navigate}
          me={me}
          onLogout={handleLogout}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </Sider>

      <Layout style={{ background: isDark ? '#141414' : '#f5f5f5' }}>
        {mobile && (
          <Header
            style={{
              background: isDark ? '#141414' : '#fff',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0',
              position: 'sticky',
              top: 0,
              zIndex: 90,
            }}
          >
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu"
            />
            <RocketOutlined style={{ color: '#2563eb', fontSize: 18 }} />
            <Typography.Text strong style={{ fontSize: 16, flex: 1 }}>
              I.H.T Logistics
            </Typography.Text>
            <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
              <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
            </Tooltip>
          </Header>
        )}

        <Content style={{ padding: mobile ? 12 : 24, minWidth: 0, background: isDark ? '#141414' : '#f5f5f5' }}>{children}</Content>
      </Layout>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={232}
        styles={{ body: { padding: 0 } }}
        closable={false}
      >
        <MenuContent
          pathname={pathname}
          onNavigate={navigate}
          me={me}
          onLogout={handleLogout}
        />
      </Drawer>
    </Layout>
  );
}