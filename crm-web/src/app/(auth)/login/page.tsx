'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Typography, App, Space } from 'antd';
import { LockOutlined, MailOutlined, RocketOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // Hàm handleSubmit: xử lý handleSubmit
  async function handleSubmit(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: { fullName: string; role: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(values) },
      );
      setToken(data.token);
      message.success('Đăng nhập thành công');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
      style={{ padding: 16 }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 24, textAlign: 'center' }}>
          <RocketOutlined style={{ fontSize: 40, color: '#2563eb' }} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            I.H.T Logistics
          </Typography.Title>
          <Typography.Text type="secondary">Đăng nhập vào hệ thống</Typography.Text>
        </Space>

        <Form layout="vertical" onFinish={handleSubmit} initialValues={{ email: 'admin@crm.com' }}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="admin@crm.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
          Tài khoản mẫu: admin@crm.com / admin123
        </Typography.Text>
      </Card>
    </div>
  );
}