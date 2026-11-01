import type { ReactElement } from 'react';
import Link from 'next/link';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export default function NotFound(): ReactElement {
  return (
    <>
      <Header />
      <main className="container" style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
        <div className="state-box" style={{ margin: '0 auto' }}>
          <div className="state-icon-circle">
            <span style={{ fontSize: '1.75rem' }}>🍊</span>
          </div>
          <h1 className="state-title" style={{ fontSize: '1.75rem' }}>
            Page Not Found
          </h1>
          <p className="state-copy">
            The page you requested could not be located. Browse our delicious selection of
            handcrafted cakes, fresh juices, and chocolates.
          </p>
          <Link href="/" className="btn-primary">
            Return to Storefront
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

