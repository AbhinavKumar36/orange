/**
 * Universal YouPI-PG Client-Side Integration (youpi.js)
 * Supports YouPI Universal JavaScript modal, dynamic vector QR codes,
 * and direct UPI deep-linking (PhonePe, Google Pay, Paytm, CRED).
 */

export interface YoupiPayOptions {
  orderId: string;
  amount: number | string;
  currency?: string;
  merchantId?: string;
  checkoutUrl?: string;
  vpa?: string;
  qrPayload?: string;
  customerName?: string;
  customerPhone?: string;
  onSuccess?: (response: { youpiPaymentId: string; utr?: string }) => void;
  onFailure?: (error: { message: string }) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    Youpi?: {
      pay?: (options: Record<string, unknown>) => void;
      open?: (options: Record<string, unknown>) => void;
      init?: (options: Record<string, unknown>) => void;
    };
  }
}

/**
 * Loads universal youpi.js integration bundle
 */
export function loadYoupiScript(baseUrl?: string, merchantKey?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve(false);
    }
    if (window.Youpi) {
      return resolve(true);
    }

    const host = (
      baseUrl ||
      process.env.NEXT_PUBLIC_YOUPI_BASE_URL ||
      'http://localhost:8080'
    ).replace(/\/+$/, '');

    const script = document.createElement('script');
    script.src = `${host}/youpi.js`;
    script.async = true;
    if (merchantKey || process.env.NEXT_PUBLIC_YOUPI_KEY) {
      script.setAttribute(
        'data-youpi-key',
        merchantKey || process.env.NEXT_PUBLIC_YOUPI_KEY || ''
      );
    }
    script.onload = () => resolve(true);
    script.onerror = () => {
      // In offline/mock mode without standalone YouPI server, graceful fallback to built-in QR modal
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Generates UPI Deep Links for installed Indian UPI apps
 */
export function buildUpiDeepLinks(params: {
  vpa: string;
  payeeName: string;
  amountRupees: string;
  orderNumber: string;
}) {
  const { vpa, payeeName, amountRupees, orderNumber } = params;
  const baseParams = `pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(orderNumber)}`;

  return {
    standard: `upi://pay?${baseParams}`,
    gpay: `gpay://upi/pay?${baseParams}`,
    phonepe: `phonepe://pay?${baseParams}`,
    paytm: `paytmmp://pay?${baseParams}`,
    cred: `cred://upi/pay?${baseParams}`,
  };
}

