/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
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
