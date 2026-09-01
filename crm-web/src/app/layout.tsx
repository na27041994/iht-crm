import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';
import AntdProvider from '@/components/AntdProvider';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'I.H.T Logistics',
  description: 'Hệ thống quản lý khách hàng cho công ty logistics',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s? s==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#141414] dark:text-gray-100">
        <AntdRegistry>
          <ThemeProvider>
            <AntdProvider>{children}</AntdProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}