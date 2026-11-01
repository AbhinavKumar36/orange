import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const API_VERSION_PREFIX = '/api/v1' as const;

// Authoritative Currency & Money Representation
// All monetary values are represented as integer INR paise (1 INR = 100 paise)
// Floating point representation for currency is strictly prohibited across API contracts
export const MoneyInPaiseSchema = z
  .number()
  .int('Monetary amounts must be integer paise.')
  .nonnegative('Monetary amounts cannot be negative.');
export type MoneyInPaise = z.infer<typeof MoneyInPaiseSchema>;

// Authoritative Database Enums Parity
export const OrderStatusEnum = [
  'draft',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'completed',
  'cancelled_expired',
  'cancelled_by_customer',
  'cancelled_by_staff',
  'cancelled_damaged_stock',
  'cancelled_inventory_depleted',
  'cancelled_uncollected',
] as const;
export const OrderStatusSchema = z.enum(OrderStatusEnum);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentStatusEnum = [
  'unpaid',
  'pending',
  'authorized',
  'captured',
  'failed',
  'refund_pending',
  'refund_processing',
  'partially_refunded',
  'refunded',
  'refund_failed',
] as const;
export const PaymentStatusSchema = z.enum(PaymentStatusEnum);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentMethodEnum = [
  'online_razorpay',
  'cash_at_pickup',
] as const;
export const PaymentMethodSchema = z.enum(PaymentMethodEnum);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const StaffRoleEnum = [
  'counter_staff',
  'manager',
  'admin',
] as const;
export const StaffRoleSchema = z.enum(StaffRoleEnum);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const RefundStatusEnum = [
  'refund_pending',
  'refund_processing',
  'refunded',
  'refund_failed',
] as const;
export const RefundStatusSchema = z.enum(RefundStatusEnum);
export type RefundStatus = z.infer<typeof RefundStatusSchema>;
