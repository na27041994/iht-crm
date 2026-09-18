/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
  allowedDevOrigins: ['192.168.1.9:3000', '192.168.1.9', 'localhost:3000', 'localhost'],
  compress: true,
  modularizeImports: {
    antd: {
      transform: 'antd/es/{{member}}',
    },
    '@ant-design/icons': {
      transform: '@ant-design/icons/es/icons/{{member}}',
    },
  },
};

export default nextConfig;
