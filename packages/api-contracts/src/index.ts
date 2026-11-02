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

export const FulfillmentTypeEnum = ['immediate', 'scheduled'] as const;
export const FulfillmentTypeSchema = z.enum(FulfillmentTypeEnum);
export type FulfillmentType = z.infer<typeof FulfillmentTypeSchema>;

export const RefundStatusEnum = [
  'refund_pending',
  'refund_processing',
  'refunded',
  'refund_failed',
] as const;
export const RefundStatusSchema = z.enum(RefundStatusEnum);
export type RefundStatus = z.infer<typeof RefundStatusSchema>;

// ============================================================================
// Catalog Domain Contracts (Phase 3: Customer Web Catalog)
// ============================================================================

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  display_order: z.number().int().default(0),
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoryListResponseSchema = z.object({
  categories: z.array(CategorySchema),
});
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string().min(1),
  categorySlug: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  basePrice: MoneyInPaiseSchema,
  taxRatePct: z.number().nonnegative().default(5.0),
  isVeg: z.boolean().default(true),
  allergens: z.array(z.string()).default([]),
  prepTimeMinutes: z.number().int().nonnegative().default(15),
  imageUrl: z.string().nullable().optional(),
  isInStock: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductListResponseSchema = z.object({
  products: z.array(ProductSchema),
});
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

export const ProductDetailResponseSchema = z.object({
  product: ProductSchema,
});
export type ProductDetailResponse = z.infer<typeof ProductDetailResponseSchema>;

/**
 * Format integer paise into displayable INR currency string.
 * Example: 65000 paise -> "₹650" (or "₹650.00" if showDecimals: true).
 */
export function formatPaiseToRupees(
  paise: number,
  options?: { showDecimals?: boolean }
): string {
  const rupees = paise / 100;
  if (options?.showDecimals) {
    return `₹${rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return Number.isInteger(rupees)
    ? `₹${rupees.toLocaleString('en-IN')}`
    : `₹${rupees.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

// ============================================================================
// Cart & Checkout Domain Contracts (Phase 5: Cart & Checkout)
// ============================================================================

export const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartValidationItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  basePrice: MoneyInPaiseSchema,
  taxRatePct: z.number(),
  quantity: z.number().int().min(1).max(100),
  lineTotal: MoneyInPaiseSchema,
  isInStock: z.boolean(),
  availableStock: z.number().int().nonnegative().optional(),
});
export type CartValidationItem = z.infer<typeof CartValidationItemSchema>;

export const ValidateCartRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
});
export type ValidateCartRequest = z.infer<typeof ValidateCartRequestSchema>;

export const ValidateCartResponseSchema = z.object({
  isValid: z.boolean(),
  items: z.array(CartValidationItemSchema),
  subtotalAmount: MoneyInPaiseSchema,
  taxAmount: MoneyInPaiseSchema,
  packagingAmount: MoneyInPaiseSchema,
  totalAmount: MoneyInPaiseSchema,
  hasOutOfStockItems: z.boolean(),
});
export type ValidateCartResponse = z.infer<typeof ValidateCartResponseSchema>;

export const CheckoutRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
  fulfillment: FulfillmentTypeSchema.default('immediate'),
  scheduledPickupAt: z.string().datetime().nullable().optional(),
  paymentMethod: PaymentMethodSchema,
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(10).max(20),
  specialNotes: z.string().max(500).optional(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  orderStatus: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
  totalAmount: MoneyInPaiseSchema,
  currency: z.literal('INR').default('INR'),
  expiresAt: z.string().nullable(),
  estimatedPickupAt: z.string().nullable().optional(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productNameSnapshot: z.string(),
  unitPriceSnapshot: MoneyInPaiseSchema,
  taxRateSnapshot: z.number(),
  quantity: z.number().int().positive(),
  lineTotal: MoneyInPaiseSchema,
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  customerId: z.string().uuid(),
  customerPhone: z.string(),
  customerName: z.string(),
  fulfillmentType: FulfillmentTypeSchema,
  scheduledPickupAt: z.string().nullable().optional(),
  estimatedPickupAt: z.string(),
  orderStatus: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
  paymentMethod: PaymentMethodSchema,
  subtotalAmount: MoneyInPaiseSchema,
  taxAmount: MoneyInPaiseSchema,
  packagingAmount: MoneyInPaiseSchema,
  totalAmount: MoneyInPaiseSchema,
  specialNotes: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
  items: z.array(OrderItemSchema).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

export const OrderDetailResponseSchema = z.object({
  order: OrderSchema,
});
export type OrderDetailResponse = z.infer<typeof OrderDetailResponseSchema>;

export const CustomerProfileSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  fullName: z.string().nullable(),
  email: z.string().nullable().optional(),
});
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

export const CustomerProfileResponseSchema = z.object({
  profile: CustomerProfileSchema,
});
export type CustomerProfileResponse = z.infer<typeof CustomerProfileResponseSchema>;

export const UpdateProfileRequestSchema = z.object({
  fullName: z.string().min(1).max(100),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

// Export Phone Normalization & Validation utilities
export {
  normalizeIndianPhoneNumber,
  isValidIndianPhoneNumber,
  type PhoneNormalizationResult,
} from './phone.js';

