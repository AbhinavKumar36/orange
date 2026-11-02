import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Moody Orange — Admin & Counter Portal',
  description: 'Live dispatch queue, inventory tracking, and counter handover verification',
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
