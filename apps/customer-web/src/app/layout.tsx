import type { ReactNode } from 'react';

export const metadata = {
  title: 'Moody Orange — Artisanal Quick-Commerce',
  description: 'Boutique artisanal cakes, fresh cold-pressed juices, and gourmet chocolates',
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

