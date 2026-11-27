import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/env.js';
import { createRazorpayOrder, createRazorpayRefund, isMockPaymentMode } from '../src/services/razorpay.js';

const baseConfig = ConfigSchema.parse({ SUPABASE_URL: 'https://hosted-project.supabase.co' });
describe('Gateway configuration failures', () => {
  it.each(['development', 'production'] as const)('never fakes payments or processed refunds with missing credentials in %s', async (nodeEnv) => {
    const config = { ...baseConfig, NODE_ENV: nodeEnv };
    await expect(createRazorpayOrder({ amount: 10000, currency: 'INR', receipt: 'QA', config })).rejects.toThrow('Razorpay is not configured');
    await expect(createRazorpayRefund({ paymentId: 'pay_QA', amount: 10000, config })).rejects.toThrow('Razorpay is not configured');
  });
  it('rejects placeholder credentials unless mock services are explicitly enabled', async () => {
    const config = { ...baseConfig, RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'exampleSecretKeyString' };
    await expect(createRazorpayOrder({ amount: 10000, currency: 'INR', receipt: 'QA', config })).rejects.toThrow('Razorpay is not configured');
  });
  it('permits isolated mock payments and refunds when explicitly enabled', async () => {
    const config = { ...baseConfig, ALLOW_MOCK_SERVICES: true };
    expect((await createRazorpayOrder({ amount: 10000, currency: 'INR', receipt: 'QA', config })).id).toMatch(/^order_mock_/);
    expect((await createRazorpayRefund({ paymentId: 'pay_QA', amount: 10000, config })).id).toMatch(/^rfnd_mock_/);
  });
  it('never enables mock signature verification in production', () => {
    expect(isMockPaymentMode({ ...baseConfig, NODE_ENV: 'production', ALLOW_MOCK_SERVICES: true })).toBe(false);
  });
});
