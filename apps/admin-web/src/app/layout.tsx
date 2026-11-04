import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Mangala Enterprises — Admin & Counter Portal',
  description: 'Live dispatch queue, inventory tracking, and counter handover verification for Mangala Enterprises',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
