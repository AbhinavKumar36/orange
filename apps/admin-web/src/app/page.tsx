'use client';

import React, { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  type DashboardMetrics,
  type AdminProductItem,
  type AdminCategoryItem,
  type AdminInventoryItem,
  type Order,
  type OrderPaymentsResponse,
  formatPaiseToRupees,
} from '@orange/api-contracts';
import { useAdminAuth } from '../lib/auth';
import {
  fetchDashboardMetrics,
  fetchAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  uploadAdminProductImage,
  toggleAdminProductStatus,
  fetchAdminCategories,
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminOrders,
  updateAdminOrderStatus,
  completeAdminOrderHandover,
  cancelAdminOrder,
  fetchAdminInventory,
  writeOffAdminInventory,
  adjustAdminInventory,
  refundAdminOrder,
  fetchAdminOrderPayments,
} from '../lib/api';

type AdminTab = 'queue' | 'overview' | 'products' | 'categories' | 'inventory';

function FoodIndicator({ classification, size = 16 }: { classification?: 'vegetarian' | 'non_vegetarian' | null; size?: number }) {
  if (!classification) {
    return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }} title="Unclassified / Non-food">—</span>;
  }
  const isVeg = classification === 'vegetarian';
  return (
    <span
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      aria-label={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        border: `1.5px solid ${isVeg ? '#168A45' : '#D32F2F'}`,
        borderRadius: '3px',
        padding: '2px',
        background: '#FFFFFF',
        verticalAlign: 'middle',
      }}
    >
      {isVeg ? (
        <span
          style={{
            width: `${Math.max(size - 8, 6)}px`,
            height: `${Math.max(size - 8, 6)}px`,
            borderRadius: '50%',
            backgroundColor: '#168A45',
            display: 'inline-block',
          }}
        />
      ) : (
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${Math.max((size - 8) / 2, 3)}px solid transparent`,
            borderRight: `${Math.max((size - 8) / 2, 3)}px solid transparent`,
            borderBottom: `${Math.max(size - 8, 6)}px solid #D32F2F`,
            display: 'inline-block',
          }}
        />
      )}
    </span>
  );
}

export default function AdminDashboardPage(): ReactElement {
  const {
    token,
    staff,
    isAuthenticated,
    isLoading: isAuthLoading,
    error: authError,
    login,
    logout,
    isManager,
    isAdmin,
  } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('queue');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [inventory, setInventory] = useState<AdminInventoryItem[]>([]);

  // Modals & form state
  const [handoverOrder, setHandoverOrder] = useState<Order | null>(null);
  const [cashCollected, setCashCollected] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    priceRupees: '',
    foodClassification: 'vegetarian' as 'vegetarian' | 'non_vegetarian' | 'unclassified',
    isVeg: true,
    prepTime: 15,
    initialStock: 10,
    lowStockThreshold: 5,
    imageUrl: '',
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const [deletingProduct, setDeletingProduct] = useState<AdminProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    displayOrder: 1,
  });

  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [writeOffForm, setWriteOffForm] = useState({
    productId: '',
    quantity: 1,
    reason: '',
  });
  const [writeOffError, setWriteOffError] = useState<string | null>(null);

  // Stock Adjustment & Out of Stock Modal State
  const [adjustModalItem, setAdjustModalItem] = useState<AdminInventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<'restock' | 'out_of_stock' | 'custom'>('restock');
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('Counter restock shipment received');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'out_of_stock' | 'low_stock' | 'in_stock'>('all');
  const [autoRefreshQueue, setAutoRefreshQueue] = useState<boolean>(true);

  const [orderFilter, setOrderFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState('all');
  const [orderSortBy, setOrderSortBy] = useState<'created_at' | 'total_amount'>('created_at');
  const [orderSortOrder, setOrderSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Refund and Payment Inspection states
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundAmountPaise, setRefundAmountPaise] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const [inspectPaymentsOrder, setInspectPaymentsOrder] = useState<Order | null>(null);
  const [inspectPaymentsData, setInspectPaymentsData] = useState<OrderPaymentsResponse | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);

  // Staff Supabase Auth credentials for login screen
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      if (activeTab === 'overview') {
        const d = await fetchDashboardMetrics(token);
        setMetrics(d);
      } else if (activeTab === 'queue') {
        setIsOrdersLoading(true);
        const ords = await fetchAdminOrders(token, {
          status: orderFilter,
          paymentStatus: orderPaymentFilter,
          fulfillment: orderFulfillmentFilter,
          search: searchQuery,
          sortBy: orderSortBy,
          sortOrder: orderSortOrder,
        });
        setOrders(ords);
        setIsOrdersLoading(false);
      } else if (activeTab === 'products') {
        const [prods, cats] = await Promise.all([
          fetchAdminProducts(token, { search: searchQuery }),
          fetchAdminCategories(token),
        ]);
        setProducts(prods);
        setCategories(cats);
      } else if (activeTab === 'categories') {
        const cats = await fetchAdminCategories(token);
        setCategories(cats);
      } else if (activeTab === 'inventory') {
        const inv = await fetchAdminInventory(token, { search: searchQuery });
        setInventory(inv);
      }
    } catch (e: unknown) {
      console.error('Failed to load tab data:', e);
      setIsOrdersLoading(false);
    }
  }, [token, activeTab, orderFilter, orderPaymentFilter, orderFulfillmentFilter, orderSortBy, orderSortOrder, searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Real-time Order Queue auto-refresh
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'queue' || !autoRefreshQueue) return;
    const interval = setInterval(() => {
      loadData();
    }, 12000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab, autoRefreshQueue, loadData]);

  // Keep product form category selection synchronized with loaded categories
  useEffect(() => {
    if (!productForm.categoryId && categories.length > 0) {
      setProductForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, productForm.categoryId]);

  // Handle Real Supabase Auth Login
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsLoggingIn(true);
    setLoginErrorMessage(null);
    try {
      const res = await login(loginEmail.trim(), loginPassword);
      if (!res.success) {
        setLoginErrorMessage(res.error || 'Failed to authenticate staff credentials.');
      }
    } catch (err: unknown) {
      setLoginErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setLoginEmail('');
    setLoginPassword('');
    setLoginErrorMessage(null);
    logout();
  };

  // Quick dev login is strictly confined to explicitly enabled development environments
  const isDevLoginEnabled =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true';

  // Quick dev login using standard local Supabase seeded staff accounts
  const handleQuickSeedLogin = async (email: string) => {
    if (!isDevLoginEnabled) return;
    setLoginEmail(email);
    setLoginPassword('password123');
    setIsLoggingIn(true);
    setLoginErrorMessage(null);
    try {
      const targetEmail = email.endsWith('.local') ? email.replace('.local', '.com') : email;
      let res = await login(targetEmail, 'password123');
      if (!res.success && targetEmail !== email) {
        res = await login(email, 'password123');
      }
      if (!res.success) {
        setLoginErrorMessage(res.error || 'Failed to authenticate staff credentials.');
      }
    } catch (err: unknown) {
      setLoginErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Checking staff credentials...</p>
      </div>
    );
  }

  // Login View
  if (!isAuthenticated) {
    const displayError = loginErrorMessage || authError;
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: '#FFF', borderRadius: '12px', padding: '2rem', border: '1px solid #E8E2D9', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🌿</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--color-brand-primary)' }}>Mangala Enterprises</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Staff & Counter Administration Portal</p>
          </div>

          {displayError && (
            <div style={{ padding: '0.75rem', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleStaffLogin} data-hydrated={isHydrated ? 'true' : 'false'}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="staff-email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Staff Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                placeholder="staff@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="staff-password" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isLoggingIn}
              style={{ width: '100%', justifyContent: 'center', opacity: isLoggingIn ? 0.7 : 1 }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Staff Portal'}
            </button>
          </form>

          {isDevLoginEnabled && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                Local Dev Seed Accounts (Supabase Auth):
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoggingIn}
                  style={{ justifyContent: 'space-between', display: 'flex', fontSize: '0.8rem' }}
                  onClick={() => handleQuickSeedLogin('staff@moodyorange.local')}
                >
                  <span>staff@moodyorange.local</span>
                  <span className="badge badge-role-staff">counter_staff</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoggingIn}
                  style={{ justifyContent: 'space-between', display: 'flex', fontSize: '0.8rem' }}
                  onClick={() => handleQuickSeedLogin('manager@moodyorange.local')}
                >
                  <span>manager@moodyorange.local</span>
                  <span className="badge badge-role-manager">manager</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoggingIn}
                  style={{ justifyContent: 'space-between', display: 'flex', fontSize: '0.8rem' }}
                  onClick={() => handleQuickSeedLogin('admin@moodyorange.local')}
                >
                  <span>admin@moodyorange.local</span>
                  <span className="badge badge-role-admin">admin</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoggingIn}
                  style={{ justifyContent: 'space-between', display: 'flex', fontSize: '0.8rem', color: '#c0392b' }}
                  onClick={() => handleQuickSeedLogin('customer@moodyorange.com')}
                  title="Verify that customer account is denied access"
                >
                  <span>customer@moodyorange.com</span>
                  <span className="badge" style={{ background: '#fce4e4', color: '#c0392b' }}>customer (denied)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Status transition handlers
  const handleAdvanceStatus = async (order: Order, nextStatus: 'preparing' | 'ready_for_pickup') => {
    if (!token) return;
    setIsActionLoading(true);
    setStatusMessage(null);
    try {
      await updateAdminOrderStatus(token, order.id, nextStatus);
      setStatusMessage(`Order #${order.orderNumber} advanced to ${nextStatus.replace('_', ' ')}.`);
      setSelectedOrderDetails((prev) => (prev?.id === order.id ? { ...prev, orderStatus: nextStatus } : prev));
      loadData();
    } catch (e: unknown) {
      setStatusMessage(`Error: ${e instanceof Error ? e.message : 'Failed to update order status'}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleHandoverSubmit = async () => {
    if (!token || !handoverOrder) return;
    setIsActionLoading(true);
    setHandoverError(null);
    try {
      await completeAdminOrderHandover(token, handoverOrder.id, cashCollected);
      const completedOrderId = handoverOrder.id;
      setHandoverOrder(null);
      setCashCollected(false);
      setStatusMessage(`Order #${handoverOrder.orderNumber} successfully handed over.`);
      setSelectedOrderDetails((prev) =>
        prev?.id === completedOrderId ? { ...prev, orderStatus: 'completed', paymentStatus: 'captured' } : prev
      );
      loadData();
    } catch (e: unknown) {
      setHandoverError(e instanceof Error ? e.message : 'Handover failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (!token) return;
    const reason = window.prompt(`Enter reason for cancelling order #${order.orderNumber}:`);
    if (!reason || !reason.trim()) return;

    setIsActionLoading(true);
    try {
      await cancelAdminOrder(token, order.id, reason.trim());
      setStatusMessage(`Order #${order.orderNumber} cancelled.`);
      setSelectedOrderDetails((prev) => (prev?.id === order.id ? { ...prev, orderStatus: 'cancelled_by_staff' } : prev));
      loadData();
    } catch (e: unknown) {
      alert(`Error cancelling order: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenRefund = (order: Order) => {
    setRefundOrder(order);
    setRefundAmountPaise(order.totalAmount);
    setRefundReason('');
    setRefundError(null);
  };

  const handleExecuteRefund = async () => {
    if (!token || !refundOrder) return;
    if (!refundReason.trim()) {
      setRefundError('Please provide a reason for the refund.');
      return;
    }
    if (refundAmountPaise <= 0 || refundAmountPaise > refundOrder.totalAmount) {
      setRefundError('Invalid refund amount.');
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    try {
      await refundAdminOrder(token, refundOrder.id, {
        amount: refundAmountPaise,
        reason: refundReason.trim(),
      });
      setStatusMessage(`Refund of ${formatPaiseToRupees(refundAmountPaise)} successfully issued for Order #${refundOrder.orderNumber}.`);
      setRefundOrder(null);
      loadData();
    } catch (e: unknown) {
      setRefundError(e instanceof Error ? e.message : 'Failed to issue refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleInspectPayments = async (order: Order) => {
    if (!token) return;
    setInspectPaymentsOrder(order);
    setInspectPaymentsData(null);
    setIsInspectLoading(true);
    try {
      const data = await fetchAdminOrderPayments(token, order.id);
      setInspectPaymentsData(data);
    } catch (e: unknown) {
      alert(`Error fetching payments: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsInspectLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: '#FFF', borderBottom: '1px solid var(--color-border)', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🌿</span>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-brand-primary)' }}>Mangala Enterprises</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Staff Operations & Dispatch</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-bg-cream)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{staff?.fullName || staff?.phone || staff?.email}</span>
            <span className={`badge badge-role-${staff?.role === 'admin' ? 'admin' : staff?.role === 'manager' ? 'manager' : 'staff'}`}>
              {staff?.role}
            </span>
          </div>

          <button type="button" onClick={handleLogout} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav style={{ background: '#FFF', borderBottom: '1px solid var(--color-border)', padding: '0 1.5rem', display: 'flex', gap: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          style={{
            padding: '0.9rem 0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'queue' ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
            color: activeTab === 'queue' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
          }}
        >
          📋 Live Dispatch Queue
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.9rem 0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'overview' ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
            color: activeTab === 'overview' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
          }}
        >
          📊 Overview (KPIs)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          style={{
            padding: '0.9rem 0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'products' ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
            color: activeTab === 'products' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
          }}
        >
          🎂 Products
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          style={{
            padding: '0.9rem 0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'categories' ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
            color: activeTab === 'categories' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
          }}
        >
          📁 Categories
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '0.9rem 0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'inventory' ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
            color: activeTab === 'inventory' ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
          }}
        >
          📦 Inventory & Stock
        </button>
      </nav>

      {/* Main Body */}
      <main style={{ padding: '1.5rem', flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {statusMessage && (
          <div style={{ padding: '0.75rem 1rem', background: '#EBF8EE', color: '#198754', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #BADBCC', display: 'flex', justifyContent: 'space-between' }}>
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} style={{ color: '#198754', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: LIVE DISPATCH QUEUE & ORDER OPERATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'queue' && (
          <div>
            {/* Filter & Operations Toolbar */}
            <div style={{ background: '#FFF', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Primary Status Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginRight: '0.4rem' }}>
                  STATUS:
                </span>
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'preparing', label: 'Preparing' },
                  { id: 'ready_for_pickup', label: '📦 Order Packed / Ready' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled_by_staff', label: 'Cancelled' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOrderFilter(st.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: orderFilter === st.id ? 'var(--color-brand-primary)' : '#F8F5F0',
                      color: orderFilter === st.id ? '#FFF' : 'var(--color-text-main)',
                      border: `1px solid ${orderFilter === st.id ? 'var(--color-brand-primary)' : 'var(--color-border)'}`,
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Secondary Filters & Search Bar */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Payment Status Dropdown */}
                <div style={{ minWidth: '150px' }}>
                  <select
                    value={orderPaymentFilter}
                    onChange={(e) => setOrderPaymentFilter(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  >
                    <option value="all">All Payments</option>
                    <option value="unpaid">Unpaid (Counter)</option>
                    <option value="pending">Pending (Online Draft)</option>
                    <option value="captured">Captured (Paid)</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {/* Fulfillment Type Dropdown */}
                <div style={{ minWidth: '140px' }}>
                  <select
                    value={orderFulfillmentFilter}
                    onChange={(e) => setOrderFulfillmentFilter(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  >
                    <option value="all">All Fulfillment</option>
                    <option value="immediate">⚡ Immediate</option>
                    <option value="scheduled">📅 Scheduled Slot</option>
                  </select>
                </div>

                {/* Sort Order Dropdown */}
                <div style={{ minWidth: '150px' }}>
                  <select
                    value={`${orderSortBy}-${orderSortOrder}`}
                    onChange={(e) => {
                      const [by, order] = e.target.value.split('-') as ['created_at' | 'total_amount', 'asc' | 'desc'];
                      setOrderSortBy(by);
                      setOrderSortOrder(order);
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  >
                    <option value="created_at-desc">Newest First</option>
                    <option value="created_at-asc">Oldest First</option>
                    <option value="total_amount-desc">Highest Amount</option>
                    <option value="total_amount-asc">Lowest Amount</option>
                  </select>
                </div>

                {/* Search Input */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <input
                    type="text"
                    placeholder="Search order #, customer name, mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                  />
                </div>

                {/* Refresh Action & Auto-refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isOrdersLoading}
                    onClick={loadData}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {isOrdersLoading ? 'Refreshing...' : '↻ Refresh Queue'}
                  </button>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={autoRefreshQueue}
                      onChange={(e) => setAutoRefreshQueue(e.target.checked)}
                      style={{ accentColor: 'var(--color-brand-primary)' }}
                    />
                    <span>Live Updates</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Orders Feed */}
            {isOrdersLoading && orders.length === 0 ? (
              <div style={{ background: '#FFF', padding: '3.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Loading live orders from Supabase...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ background: '#FFF', padding: '3.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>No orders found</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                  No customer orders match the selected status, payment, or search filters.
                </p>
                {(orderFilter !== 'all' || orderPaymentFilter !== 'all' || orderFulfillmentFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setOrderFilter('all');
                      setOrderPaymentFilter('all');
                      setOrderFulfillmentFilter('all');
                      setSearchQuery('');
                    }}
                    style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      background: '#FFF',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--color-brand-primary)' }}>
                              #{ord.orderNumber}
                            </strong>
                            {ord.fulfillmentType === 'scheduled' ? (
                              <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#E0F2FE', color: '#0369A1', fontWeight: 600 }}>
                                📅 Scheduled
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', fontWeight: 600 }}>
                                ⚡ Immediate
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                            Placed {new Date(ord.createdAt).toLocaleDateString()} at {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className={`badge badge-${ord.orderStatus}`}>
                          {ord.orderStatus.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div style={{ margin: '0.65rem 0', padding: '0.55rem 0', borderTop: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ord.customerName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{ord.customerPhone}</span>
                        </div>
                        {ord.fulfillmentType === 'scheduled' && ord.scheduledPickupAt && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#0369A1', background: '#F0F9FF', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                            ⏰ Pickup Slot: {new Date(ord.scheduledPickupAt).toLocaleString()}
                          </div>
                        )}
                        {ord.specialNotes && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', background: 'var(--color-bg-cream)', padding: '0.3rem 0.5rem', borderRadius: '4px', color: '#444' }}>
                            📝 {ord.specialNotes}
                          </div>
                        )}
                      </div>

                      {/* Line Items Snapshot */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>
                          ORDER ITEMS ({(ord.items || []).length})
                        </div>
                        {(ord.items || []).map((it) => (
                          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                            <span>
                              <span style={{ fontWeight: 600 }}>{it.quantity}x</span> {it.productNameSnapshot}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}>{formatPaiseToRupees(it.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      {/* Price & Payment Summary */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 0.9rem 0', padding: '0.6rem 0.8rem', background: '#F8F5F0', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {ord.paymentMethod === 'cash_at_pickup' ? 'Cash at Counter' : 'Online Payment (Razorpay)'}
                          </div>
                          <span
                            className={`badge badge-${ord.paymentStatus}`}
                            style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}
                          >
                            {ord.paymentStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Total Amount</div>
                          <strong style={{ fontSize: '1.15rem', color: 'var(--color-brand-primary)' }}>
                            {formatPaiseToRupees(ord.totalAmount)}
                          </strong>
                        </div>
                      </div>

                      {/* Operations Actions */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {/* Details Modal Trigger */}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                          onClick={() => setSelectedOrderDetails(ord)}
                          title="Open full order details modal"
                        >
                          🔍 Details
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                          onClick={() => handleInspectPayments(ord)}
                          title="View payment attempts and gateway transactions"
                        >
                          💳 Payments
                        </button>

                        {isManager &&
                          ord.paymentMethod === 'online_razorpay' &&
                          ['captured', 'partially_refunded'].includes(ord.paymentStatus) && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{
                                fontSize: '0.8rem',
                                padding: '0.35rem 0.6rem',
                                color: '#b91c1c',
                                borderColor: '#fca5a5',
                              }}
                              onClick={() => handleOpenRefund(ord)}
                            >
                              ↩️ Refund
                            </button>
                          )}

                        {ord.orderStatus === 'confirmed' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.35rem 0.6rem', background: '#0D6EFD' }}
                            disabled={isActionLoading}
                            onClick={() => handleAdvanceStatus(ord, 'preparing')}
                          >
                            📦 Mark Order Packed
                          </button>
                        )}

                        {ord.orderStatus === 'preparing' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.35rem 0.6rem', background: '#198754' }}
                            disabled={isActionLoading}
                            onClick={() => handleAdvanceStatus(ord, 'ready_for_pickup')}
                          >
                            Ready for Pickup
                          </button>
                        )}

                        {ord.orderStatus === 'ready_for_pickup' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.35rem 0.6rem', background: '#198754' }}
                            disabled={isActionLoading}
                            onClick={() => {
                              setHandoverOrder(ord);
                              setCashCollected(ord.paymentMethod !== 'cash_at_pickup');
                            }}
                          >
                            🤝 Complete Handover
                          </button>
                        )}

                        {isManager && ord.orderStatus !== 'completed' && !ord.orderStatus.startsWith('cancelled') && (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleCancelOrder(ord)}
                            title="Cancel order with authoritative reason"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: OVERVIEW KPIS */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && metrics && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL ORDERS</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem' }}>{metrics.totalOrders}</div>
              </div>

              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: '#B7791F', fontWeight: 600 }}>AWAITING PREP</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem', color: '#B7791F' }}>{metrics.ordersAwaitingProcessing}</div>
              </div>

              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: '#0D6EFD', fontWeight: 600 }}>READY AT COUNTER</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem', color: '#0D6EFD' }}>{metrics.ordersReadyForPickup}</div>
              </div>

              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: '#198754', fontWeight: 600 }}>COMPLETED ORDERS</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem', color: '#198754' }}>{metrics.completedOrders}</div>
              </div>

              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-brand-primary)', fontWeight: 600 }}>GROSS SALES</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem', color: 'var(--color-brand-primary)' }}>
                  {formatPaiseToRupees(metrics.grossSalesPaise)}
                </div>
              </div>

              <div style={{ background: '#FFF', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.8rem', color: metrics.lowStockProducts > 0 ? '#DC3545' : 'var(--color-text-muted)', fontWeight: 600 }}>
                  LOW STOCK ITEMS
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.3rem', color: metrics.lowStockProducts > 0 ? '#DC3545' : 'inherit' }}>
                  {metrics.lowStockProducts}
                </div>
              </div>
            </div>

            {metrics.lowStockAlerts.length > 0 && (
              <div style={{ background: '#FFF8E6', border: '1px solid #FFE082', borderRadius: '10px', padding: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#B7791F', marginBottom: '0.5rem' }}>
                  ⚠️ Low Stock Threshold Alerts
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {metrics.lowStockAlerts.map((it) => (
                    <span key={it.id} style={{ background: '#FFF', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #FFE082' }}>
                      <strong>{it.name}</strong>: {it.availableStock} available (threshold {it.lowStockThreshold})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PRODUCTS */}
        {/* ========================================================================= */}
        {activeTab === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <input
                type="text"
                placeholder="Search products by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '320px' }}
              />

              {isManager && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditingProduct(null);
                    const initialCatId = categories.length > 0 ? categories[0].id : '';
                    setProductForm({
                      name: '',
                      slug: '',
                      categoryId: initialCatId,
                      description: '',
                      priceRupees: '',
                      foodClassification: 'vegetarian',
                      isVeg: true,
                      prepTime: 15,
                      initialStock: 10,
                      lowStockThreshold: 5,
                      imageUrl: '',
                    });
                    setImageUploadError(null);
                    setIsProductModalOpen(true);
                  }}
                >
                  + Add Product
                </button>
              )}
            </div>

            <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-cream)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Dietary</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Active</th>
                    {isManager && <th style={{ padding: '0.75rem 1rem' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                background: 'var(--color-bg-cream)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              🍃
                            </div>
                          )}
                          <div>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{p.categoryName}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatPaiseToRupees(p.basePrice)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: p.availableStock <= p.lowStockThreshold ? 700 : 400, color: p.availableStock <= p.lowStockThreshold ? '#DC3545' : 'inherit' }}>
                          {p.availableStock}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}> ({p.physicalStock} phys / {p.reservedStock} res)</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <FoodIndicator classification={p.foodClassification ?? (p.isVeg ? 'vegetarian' : 'non_vegetarian')} />
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {p.foodClassification === 'vegetarian' || (!p.foodClassification && p.isVeg)
                              ? 'Veg'
                              : p.foodClassification === 'non_vegetarian' || (!p.foodClassification && !p.isVeg)
                              ? 'Non-Veg'
                              : 'Non-Food'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token || !isManager) return;
                            await toggleAdminProductStatus(token, p.id, !p.isActive);
                            loadData();
                          }}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: p.isActive ? '#EBF8EE' : '#FEECEB',
                            color: p.isActive ? '#198754' : '#DC3545',
                          }}
                        >
                          {p.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      {isManager && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  name: p.name,
                                  slug: p.slug,
                                  categoryId: p.categoryId,
                                  description: p.description || '',
                                  priceRupees: (p.basePrice / 100).toString(),
                                  foodClassification: p.foodClassification ?? (p.isVeg ? 'vegetarian' : 'non_vegetarian'),
                                  isVeg: p.isVeg,
                                  prepTime: p.prepTimeMinutes,
                                  initialStock: p.physicalStock,
                                  lowStockThreshold: p.lowStockThreshold,
                                  imageUrl: p.imageUrl || '',
                                });
                                setImageUploadError(null);
                                setIsProductModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#FEECEB', color: '#DC3545' }}
                              onClick={() => setDeletingProduct(p)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CATEGORIES */}
        {/* ========================================================================= */}
        {activeTab === 'categories' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
              {isManager && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setCategoryForm({ name: '', slug: '', description: '', displayOrder: categories.length + 1 });
                    setIsCategoryModalOpen(true);
                  }}
                >
                  + Add Category
                </button>
              )}
            </div>

            <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-cream)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Order</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Slug</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Products</th>
                    {isAdmin && <th style={{ padding: '0.75rem 1rem' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.display_order}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <strong>{c.name}</strong>
                        {c.description && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.description}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.slug}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.productCount} items</td>
                      {isAdmin && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={async () => {
                              if (!token) return;
                              if (c.productCount > 0) {
                                alert(`Cannot delete category '${c.name}': it currently contains ${c.productCount} products.`);
                                return;
                              }
                              if (confirm(`Delete category '${c.name}'?`)) {
                                await deleteAdminCategory(token, c.id);
                                loadData();
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: INVENTORY & STOCK */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <input
                type="text"
                placeholder="Search inventory by product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '320px' }}
              />

              {isManager && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: '#DC3545', borderColor: '#DC3545' }}
                  onClick={() => {
                    setWriteOffForm({ productId: inventory[0]?.productId || '', quantity: 1, reason: '' });
                    setWriteOffError(null);
                    setIsWriteOffModalOpen(true);
                  }}
                >
                  ⚠️ Record Damage Write-off
                </button>
              )}
            </div>

            {/* Inventory Status Quick Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`tab-btn ${inventoryFilter === 'all' ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setInventoryFilter('all')}
              >
                All Items ({inventory.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${inventoryFilter === 'out_of_stock' ? 'active' : ''}`}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  color: inventory.filter((i) => i.availableStock <= 0).length > 0 ? '#DC3545' : 'inherit',
                  borderColor: inventoryFilter === 'out_of_stock' ? '#DC3545' : undefined,
                  fontWeight: inventory.filter((i) => i.availableStock <= 0).length > 0 ? 700 : 500,
                }}
                onClick={() => setInventoryFilter('out_of_stock')}
              >
                🔴 Out of Stock ({inventory.filter((i) => i.availableStock <= 0).length})
              </button>
              <button
                type="button"
                className={`tab-btn ${inventoryFilter === 'low_stock' ? 'active' : ''}`}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  color: inventory.filter((i) => i.availableStock > 0 && i.isLowStock).length > 0 ? '#B7791F' : 'inherit',
                  borderColor: inventoryFilter === 'low_stock' ? '#B7791F' : undefined,
                }}
                onClick={() => setInventoryFilter('low_stock')}
              >
                🟡 Low Stock ({inventory.filter((i) => i.availableStock > 0 && i.isLowStock).length})
              </button>
              <button
                type="button"
                className={`tab-btn ${inventoryFilter === 'in_stock' ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setInventoryFilter('in_stock')}
              >
                🟢 Optimal ({inventory.filter((i) => i.availableStock > i.lowStockThreshold).length})
              </button>
            </div>

            <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-cream)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Physical Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Reserved (Active Orders)</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Available</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Threshold</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Stock Status</th>
                    {isManager && <th style={{ padding: '0.75rem 1rem' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventory
                    .filter((inv) => {
                      if (inventoryFilter === 'out_of_stock') return inv.availableStock <= 0;
                      if (inventoryFilter === 'low_stock') return inv.availableStock > 0 && inv.isLowStock;
                      if (inventoryFilter === 'in_stock') return inv.availableStock > inv.lowStockThreshold;
                      return true;
                    })
                    .map((inv) => (
                    <tr key={inv.productId} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <strong>{inv.productName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{inv.categoryName}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{inv.physicalStock}</td>
                      <td style={{ padding: '0.75rem 1rem', color: inv.reservedStock > 0 ? '#B7791F' : 'inherit' }}>
                        {inv.reservedStock}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: inv.availableStock <= 0 ? '#DC3545' : inv.isLowStock ? '#B7791F' : 'inherit' }}>
                        {inv.availableStock}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{inv.lowStockThreshold}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {inv.availableStock <= 0 ? (
                          <span
                            className="badge"
                            style={{
                              background: '#FEE2E2',
                              color: '#B91C1C',
                              border: '1px solid #F87171',
                              fontWeight: 700,
                              padding: '0.25rem 0.55rem',
                            }}
                          >
                            🔴 Out of Stock
                          </span>
                        ) : inv.isLowStock ? (
                          <span
                            className="badge"
                            style={{
                              background: '#FEF3C7',
                              color: '#92400E',
                              border: '1px solid #FBBF24',
                              fontWeight: 700,
                              padding: '0.25rem 0.55rem',
                            }}
                          >
                            🟡 Low Stock ({inv.availableStock})
                          </span>
                        ) : (
                          <span className="badge badge-confirmed">
                            🟢 Optimal ({inv.availableStock})
                          </span>
                        )}
                      </td>
                      {isManager && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className={inv.availableStock <= 0 ? 'btn-primary' : 'btn-secondary'}
                              style={{
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.78rem',
                                background: inv.availableStock <= 0 ? '#198754' : undefined,
                              }}
                              onClick={() => {
                                setAdjustModalItem(inv);
                                setAdjustMode('restock');
                                setAdjustDelta(10);
                                setAdjustReason('Counter restock shipment received');
                                setAdjustError(null);
                              }}
                              title="Restock units or adjust inventory"
                            >
                              {inv.availableStock <= 0 ? '+ Restock Now' : '📦 Adjust / Restock'}
                            </button>

                            {inv.availableStock > 0 && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  color: '#DC3545',
                                  borderColor: '#FCA5A5',
                                }}
                                onClick={() => {
                                  setAdjustModalItem(inv);
                                  setAdjustMode('out_of_stock');
                                  setAdjustDelta(-inv.availableStock);
                                  setAdjustReason('Vitrine counter display depleted / marked out of stock');
                                  setAdjustError(null);
                                }}
                                title="Instantly reduce available stock to 0"
                              >
                                Mark Out of Stock
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Handover Modal */}
      {handoverOrder && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Counter Handover Verification</h3>
              <button type="button" onClick={() => setHandoverOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              {handoverError && (
                <div style={{ padding: '0.75rem', background: '#FEECEB', color: '#DC3545', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {handoverError}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <strong>Order #{handoverOrder.orderNumber}</strong>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Customer: {handoverOrder.customerName} ({handoverOrder.customerPhone})</div>
              </div>

              <div style={{ background: 'var(--color-bg-cream)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>ITEMS:</div>
                {(handoverOrder.items || []).map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{it.quantity}x {it.productNameSnapshot}</span>
                    <span>{formatPaiseToRupees(it.lineTotal)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total Amount</span>
                  <span style={{ color: 'var(--color-brand-primary)' }}>{formatPaiseToRupees(handoverOrder.totalAmount)}</span>
                </div>
              </div>

              {handoverOrder.paymentMethod === 'cash_at_pickup' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem', background: '#FFF8E6', borderRadius: '8px', border: '1px solid #FFE082', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cashCollected}
                    onChange={(e) => setCashCollected(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#B7791F' }}>
                    I confirm physical receipt of {formatPaiseToRupees(handoverOrder.totalAmount)} in cash from the customer.
                  </span>
                </label>
              ) : (
                <div style={{ padding: '0.75rem', background: '#EBF8EE', borderRadius: '8px', fontSize: '0.85rem', color: '#198754', fontWeight: 600 }}>
                  ✓ Online payment verified and captured.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setHandoverOrder(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#198754' }}
                disabled={isActionLoading || (handoverOrder.paymentMethod === 'cash_at_pickup' && !cashCollected)}
                onClick={handleHandoverSubmit}
              >
                Confirm & Complete Handover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment & Out of Stock Modal */}
      {adjustModalItem && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                {adjustMode === 'out_of_stock' ? 'Mark Out of Stock' : 'Stock Adjustment & Restock'}
              </h3>
              <button type="button" onClick={() => setAdjustModalItem(null)}>✕</button>
            </div>

            <div className="modal-body">
              {adjustError && (
                <div style={{ padding: '0.75rem', background: '#FEECEB', color: '#DC3545', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {adjustError}
                </div>
              )}

              <div style={{ background: 'var(--color-bg-cream)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <strong style={{ fontSize: '1rem' }}>{adjustModalItem.productName}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{adjustModalItem.categoryName}</div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', fontSize: '0.82rem' }}>
                  <span>Physical: <strong>{adjustModalItem.physicalStock}</strong></span>
                  <span>Reserved: <strong>{adjustModalItem.reservedStock}</strong></span>
                  <span style={{ color: adjustModalItem.availableStock <= 0 ? '#DC3545' : 'inherit' }}>
                    Available: <strong>{adjustModalItem.availableStock}</strong>
                  </span>
                </div>
              </div>

              {/* Action Mode Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`btn-secondary ${adjustMode === 'restock' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    background: adjustMode === 'restock' ? '#EBF8EE' : undefined,
                    borderColor: adjustMode === 'restock' ? '#198754' : undefined,
                    color: adjustMode === 'restock' ? '#198754' : undefined,
                  }}
                  onClick={() => {
                    setAdjustMode('restock');
                    setAdjustDelta(10);
                    setAdjustReason('Counter restock shipment received');
                  }}
                >
                  📥 Restock (+)
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${adjustMode === 'out_of_stock' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    background: adjustMode === 'out_of_stock' ? '#FEECEB' : undefined,
                    borderColor: adjustMode === 'out_of_stock' ? '#DC3545' : undefined,
                    color: adjustMode === 'out_of_stock' ? '#DC3545' : undefined,
                  }}
                  onClick={() => {
                    setAdjustMode('out_of_stock');
                    setAdjustDelta(-adjustModalItem.availableStock);
                    setAdjustReason('Vitrine counter display depleted / marked out of stock');
                  }}
                >
                  ⚡ Set Out of Stock
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${adjustMode === 'custom' ? 'active' : ''}`}
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={() => {
                    setAdjustMode('custom');
                    setAdjustDelta(0);
                    setAdjustReason('Counter physical inventory count correction');
                  }}
                >
                  ✏️ Custom (+/-)
                </button>
              </div>

              {/* Quantity delta input & quick chips */}
              {adjustMode === 'restock' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Restock Quantity to ADD (Units)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {[5, 10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className="btn-secondary"
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.8rem',
                          background: adjustDelta === num ? '#EBF8EE' : undefined,
                          borderColor: adjustDelta === num ? '#198754' : undefined,
                        }}
                        onClick={() => setAdjustDelta(num)}
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {adjustMode === 'out_of_stock' && (
                <div style={{ padding: '0.75rem', background: '#FEECEB', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#B91C1C' }}>
                  <strong>Marking Out of Stock:</strong> This will reduce physical stock by {adjustModalItem.availableStock} units so available stock becomes <strong>0</strong>. Customers will see &ldquo;Out of Stock&rdquo; immediately.
                </div>
              )}

              {adjustMode === 'custom' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Adjustment Delta (+ to add, - to subtract)
                  </label>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Reason input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Adjustment Reason (Required for Audit Log)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter restock shipment received"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              {/* Calculated preview */}
              <div style={{ padding: '0.65rem 0.85rem', background: '#F8F9FA', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid var(--color-border)' }}>
                <span>Stock Preview: </span>
                Physical: {adjustModalItem.physicalStock} → <strong>{Math.max(adjustModalItem.reservedStock, adjustModalItem.physicalStock + adjustDelta)}</strong> |
                Available: {adjustModalItem.availableStock} → <strong style={{ color: (adjustModalItem.availableStock + adjustDelta) <= 0 ? '#DC3545' : '#198754' }}>
                  {Math.max(0, adjustModalItem.availableStock + adjustDelta)}
                </strong>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setAdjustModalItem(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={isAdjusting || !adjustReason.trim() || adjustDelta === 0}
                onClick={async () => {
                  if (!token || !adjustModalItem) return;
                  setIsAdjusting(true);
                  setAdjustError(null);
                  try {
                    await adjustAdminInventory(token, {
                      productId: adjustModalItem.productId,
                      physicalStockDelta: adjustDelta,
                      reason: adjustReason.trim(),
                    });
                    setStatusMessage(`Inventory adjusted for ${adjustModalItem.productName}.`);
                    setAdjustModalItem(null);
                    loadData();
                  } catch (e: unknown) {
                    setAdjustError(e instanceof Error ? e.message : 'Inventory adjustment failed');
                  } finally {
                    setIsAdjusting(false);
                  }
                }}
              >
                {isAdjusting ? 'Updating Stock...' : 'Confirm Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-off Modal */}
      {isWriteOffModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#DC3545' }}>Record Damage Write-off</h3>
              <button type="button" onClick={() => setIsWriteOffModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {writeOffError && (
                <div style={{ padding: '0.75rem', background: '#FEECEB', color: '#DC3545', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {writeOffError}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Product</label>
                <select
                  value={writeOffForm.productId}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, productId: e.target.value })}
                >
                  {inventory.map((inv) => (
                    <option key={inv.productId} value={inv.productId}>
                      {inv.productName} (Unreserved: {inv.availableStock})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Damaged Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={writeOffForm.quantity}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, quantity: parseInt(e.target.value, 10) || 1 })}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Reason for Write-off</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Broken refrigeration during transit, dropped packaging"
                  value={writeOffForm.reason}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsWriteOffModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                disabled={!writeOffForm.reason.trim() || writeOffForm.quantity < 1}
                onClick={async () => {
                  if (!token) return;
                  setWriteOffError(null);
                  try {
                    await writeOffAdminInventory(token, {
                      productId: writeOffForm.productId,
                      damagedQuantity: writeOffForm.quantity,
                      reason: writeOffForm.reason.trim(),
                    });
                    setIsWriteOffModalOpen(false);
                    setStatusMessage(`Damage write-off recorded.`);
                    loadData();
                  } catch (e: unknown) {
                    setWriteOffError(e instanceof Error ? e.message : 'Write-off failed');
                  }
                }}
              >
                Record Write-off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button type="button" onClick={() => setIsProductModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Name</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      setProductForm({ ...productForm, name, slug: editingProduct ? productForm.slug : slug });
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Slug</label>
                  <input
                    type="text"
                    value={productForm.slug}
                    onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Category</label>
                <select
                  value={productForm.categoryId || (categories[0]?.id ?? '')}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Price in ₹ (Rupees)</label>
                  <input
                    type="number"
                    placeholder="e.g. 350"
                    value={productForm.priceRupees}
                    onChange={(e) => setProductForm({ ...productForm, priceRupees: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Prep Time (mins)</label>
                  <input
                    type="number"
                    value={productForm.prepTime}
                    onChange={(e) => setProductForm({ ...productForm, prepTime: parseInt(e.target.value, 10) || 15 })}
                  />
                </div>
              </div>

              {!editingProduct && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Initial Physical Stock</label>
                    <input
                      type="number"
                      value={productForm.initialStock}
                      onChange={(e) => setProductForm({ ...productForm, initialStock: parseInt(e.target.value, 10) || 10 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      value={productForm.lowStockThreshold}
                      onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: parseInt(e.target.value, 10) || 5 })}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Description</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              {/* Food Classification */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg-cream)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Dietary / Food Classification
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="foodClassification"
                      value="vegetarian"
                      checked={productForm.foodClassification === 'vegetarian'}
                      onChange={() => setProductForm({ ...productForm, foodClassification: 'vegetarian', isVeg: true })}
                      style={{ width: 'auto' }}
                    />
                    <FoodIndicator classification="vegetarian" size={16} />
                    <span>Vegetarian</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="foodClassification"
                      value="non_vegetarian"
                      checked={productForm.foodClassification === 'non_vegetarian'}
                      onChange={() => setProductForm({ ...productForm, foodClassification: 'non_vegetarian', isVeg: false })}
                      style={{ width: 'auto' }}
                    />
                    <FoodIndicator classification="non_vegetarian" size={16} />
                    <span>Non-Vegetarian</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="foodClassification"
                      value="unclassified"
                      checked={productForm.foodClassification === 'unclassified'}
                      onChange={() => setProductForm({ ...productForm, foodClassification: 'unclassified', isVeg: false })}
                      style={{ width: 'auto' }}
                    />
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    <span>Not Applicable / Non-Food</span>
                  </label>
                </div>
              </div>

              {/* Image Upload */}
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Product Image (Device Upload to Supabase Storage)
                </label>
                
                {productForm.imageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem', padding: '0.5rem', background: '#FFF', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                    <img
                      src={productForm.imageUrl}
                      alt="Product preview"
                      style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {productForm.imageUrl}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-danger"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setProductForm({ ...productForm, imageUrl: '' })}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={isUploadingImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    if (!file.type.startsWith('image/')) {
                      setImageUploadError('Please select a valid image file (JPEG, PNG, WebP, SVG).');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setImageUploadError('Image size exceeds 5MB limit.');
                      return;
                    }
                    setIsUploadingImage(true);
                    setImageUploadError(null);
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = reader.result as string;
                        try {
                          const res = await uploadAdminProductImage(token, base64, file.name, file.type);
                          setProductForm((prev) => ({ ...prev, imageUrl: res.url }));
                          setStatusMessage('Image uploaded successfully to Supabase Storage.');
                        } catch (err: unknown) {
                          setImageUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
                        } finally {
                          setIsUploadingImage(false);
                        }
                      };
                      reader.onerror = () => {
                        setImageUploadError('Failed to read image file.');
                        setIsUploadingImage(false);
                      };
                      reader.readAsDataURL(file);
                    } catch (err: unknown) {
                      setImageUploadError(err instanceof Error ? err.message : 'Upload failed.');
                      setIsUploadingImage(false);
                    }
                  }}
                  style={{ fontSize: '0.85rem' }}
                />
                {isUploadingImage && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-brand-primary)', marginTop: '0.3rem' }}>
                    ⏳ Uploading image to storage bucket...
                  </div>
                )}
                {imageUploadError && (
                  <div style={{ fontSize: '0.8rem', color: '#DC3545', marginTop: '0.3rem' }}>
                    {imageUploadError}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={isUploadingImage}
                onClick={async () => {
                  if (!token) return;
                  const pricePaise = Math.round(parseFloat(productForm.priceRupees) * 100);
                  if (isNaN(pricePaise) || pricePaise <= 0) {
                    alert('Please enter a valid price in rupees.');
                    return;
                  }

                  const selectedCategoryId = productForm.categoryId || (categories[0]?.id ?? '');
                  if (!selectedCategoryId) {
                    alert('Please select a category for this product.');
                    return;
                  }

                  const foodClassification =
                    productForm.foodClassification === 'unclassified'
                      ? null
                      : productForm.foodClassification;
                  const isVeg = productForm.foodClassification === 'vegetarian';

                  try {
                    if (editingProduct) {
                      await updateAdminProduct(token, editingProduct.id, {
                        name: productForm.name,
                        slug: productForm.slug,
                        categoryId: selectedCategoryId,
                        description: productForm.description,
                        basePrice: pricePaise,
                        foodClassification,
                        isVeg,
                        prepTimeMinutes: productForm.prepTime,
                        imageUrl: productForm.imageUrl ? productForm.imageUrl : null,
                      });
                    } else {
                      await createAdminProduct(token, {
                        name: productForm.name,
                        slug: productForm.slug,
                        categoryId: selectedCategoryId,
                        description: productForm.description,
                        basePrice: pricePaise,
                        foodClassification,
                        isVeg,
                        prepTimeMinutes: productForm.prepTime,
                        initialStock: productForm.initialStock,
                        lowStockThreshold: productForm.lowStockThreshold,
                        imageUrl: productForm.imageUrl ? productForm.imageUrl : null,
                        taxRatePct: 5,
                        allergens: [],
                        isActive: true,
                      });
                    }
                    setIsProductModalOpen(false);
                    setStatusMessage(`Product saved successfully.`);
                    loadData();
                  } catch (e: unknown) {
                    alert(`Error saving product: ${e instanceof Error ? e.message : 'Unknown error'}`);
                  }
                }}
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deletingProduct && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#DC3545' }}>Confirm Product Removal</h3>
              <button type="button" onClick={() => setDeletingProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                Are you sure you want to remove <strong>{deletingProduct.name}</strong>?
              </p>
              <div style={{ padding: '0.75rem', background: 'var(--color-bg-cream)', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                ℹ️ <strong>Safe Deletion Policy:</strong> If this product has existing customer orders, it will be safely deactivated/archived to protect historical receipts. If it has no order history, it will be permanently removed.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={isDeleting}
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={isDeleting}
                onClick={async () => {
                  if (!token || !deletingProduct) return;
                  setIsDeleting(true);
                  try {
                    const res = await deleteAdminProduct(token, deletingProduct.id);
                    setStatusMessage(
                      res.archived
                        ? `Product "${deletingProduct.name}" has order history and was deactivated/archived.`
                        : `Product "${deletingProduct.name}" was permanently removed.`
                    );
                    setDeletingProduct(null);
                    loadData();
                  } catch (err: unknown) {
                    alert(`Failed to delete product: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete / Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Category</h3>
              <button type="button" onClick={() => setIsCategoryModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setCategoryForm({ ...categoryForm, name, slug });
                  }}
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Slug</label>
                <input
                  type="text"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Display Order</label>
                <input
                  type="number"
                  value={categoryForm.displayOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: parseInt(e.target.value, 10) || 1 })}
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Description</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  if (!token) return;
                  try {
                    await createAdminCategory(token, {
                      name: categoryForm.name.trim(),
                      slug: categoryForm.slug.trim(),
                      description: categoryForm.description.trim() || null,
                      display_order: categoryForm.displayOrder,
                    });
                    setIsCategoryModalOpen(false);
                    setStatusMessage(`Category created.`);
                    loadData();
                  } catch (e: unknown) {
                    alert(`Error creating category: ${e instanceof Error ? e.message : 'Unknown error'}`);
                  }
                }}
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Issue Refund Modal */}
      {refundOrder && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Issue Refund — Order #{refundOrder.orderNumber}
              </h3>
              <button type="button" onClick={() => setRefundOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              {refundError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                  ⚠️ {refundError}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span>Customer:</span>
                  <strong>{refundOrder.customerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span>Payment Method:</span>
                  <strong style={{ textTransform: 'capitalize' }}>{refundOrder.paymentMethod.replace(/_/g, ' ')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Order Total:</span>
                  <strong style={{ color: 'var(--color-brand-primary)' }}>{formatPaiseToRupees(refundOrder.totalAmount)}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={refundOrder.totalAmount / 100}
                  value={refundAmountPaise / 100}
                  onChange={(e) => {
                    const rupees = parseFloat(e.target.value) || 0;
                    setRefundAmountPaise(Math.round(rupees * 100));
                  }}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Default is full refund of remaining balance: {formatPaiseToRupees(refundOrder.totalAmount)}
                </div>
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Reason for Refund *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Item unavailable; Customer requested cancellation"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setRefundOrder(null)} disabled={isRefunding}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={isRefunding || !refundReason.trim()}
                onClick={handleExecuteRefund}
              >
                {isRefunding ? 'Processing Gateway Refund...' : 'Confirm & Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Payments Modal */}
      {inspectPaymentsOrder && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Payment Details — Order #{inspectPaymentsOrder.orderNumber}
              </h3>
              <button type="button" onClick={() => setInspectPaymentsOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              {isInspectLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Loading payment attempts & gateway records...
                </div>
              ) : inspectPaymentsData ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div style={{ background: '#f1f5f9', padding: '0.6rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Captured</div>
                      <strong style={{ fontSize: '1rem', color: '#16a34a' }}>
                        {formatPaiseToRupees(inspectPaymentsData.totalCaptured)}
                      </strong>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '0.6rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Refunded</div>
                      <strong style={{ fontSize: '1rem', color: '#dc2626' }}>
                        {formatPaiseToRupees(inspectPaymentsData.totalRefunded)}
                      </strong>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '0.6rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Remaining Balance</div>
                      <strong style={{ fontSize: '1rem', color: '#0284c7' }}>
                        {formatPaiseToRupees(inspectPaymentsData.remainingRefundable)}
                      </strong>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Payment Attempts ({inspectPaymentsData.payments.length})
                  </h4>
                  {inspectPaymentsData.payments.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>No payment attempts recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                      {inspectPaymentsData.payments.map((p) => (
                        <div key={p.id} style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <strong>{p.providerPaymentId || p.providerOrderId || p.provider}</strong>
                            <span className={`badge badge-${p.status}`}>{p.status}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Amount: {formatPaiseToRupees(p.amount)}</span>
                            <span>{new Date(p.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Refund Records ({inspectPaymentsData.refunds.length})
                  </h4>
                  {inspectPaymentsData.refunds.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No refunds issued for this order.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inspectPaymentsData.refunds.map((r) => (
                        <div key={r.id} style={{ background: '#fef2f2', padding: '0.6rem', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <strong>{r.providerRefundId || r.id}</strong>
                            <span className={`badge badge-${r.status}`}>{r.status}</span>
                          </div>
                          <div style={{ color: '#475569', marginBottom: '0.2rem' }}>Reason: {r.reason}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Amount: {formatPaiseToRupees(r.amount)}</span>
                            <span>{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setInspectPaymentsOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDER OPERATIONS: FULL ORDER DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedOrderDetails && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedOrderDetails(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Order Operations Details"
        >
          <div
            className="modal-card"
            style={{ maxWidth: '680px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                  Order Details — #{selectedOrderDetails.orderNumber}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Placed on {new Date(selectedOrderDetails.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', padding: '0.2rem 0.5rem' }}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Lifecycle & Payment Badges */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge badge-${selectedOrderDetails.orderStatus}`} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>
                  Status: {selectedOrderDetails.orderStatus.replace(/_/g, ' ')}
                </span>
                <span className={`badge badge-${selectedOrderDetails.paymentStatus}`} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>
                  Payment: {selectedOrderDetails.paymentStatus.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '9999px', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
                  Mode: {selectedOrderDetails.paymentMethod === 'cash_at_pickup' ? 'Cash at Counter' : 'Online Razorpay'}
                </span>
                <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '9999px', background: selectedOrderDetails.fulfillmentType === 'scheduled' ? '#E0F2FE' : '#FEF3C7', color: selectedOrderDetails.fulfillmentType === 'scheduled' ? '#0369A1' : '#B45309', fontWeight: 600 }}>
                  {selectedOrderDetails.fulfillmentType === 'scheduled' ? '📅 Scheduled Pickup' : '⚡ Immediate Pickup'}
                </span>
              </div>

              {/* Customer & Fulfillment Information */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', background: '#F8F5F0', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                    CUSTOMER CONTACT
                  </h4>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedOrderDetails.customerName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                    📱 {selectedOrderDetails.customerPhone}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                    ID: {selectedOrderDetails.customerId}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                    FULFILLMENT SCHEDULE
                  </h4>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Type:</strong> {selectedOrderDetails.fulfillmentType === 'scheduled' ? 'Scheduled Slot' : 'Immediate Preparation'}
                  </div>
                  {selectedOrderDetails.fulfillmentType === 'scheduled' && selectedOrderDetails.scheduledPickupAt && (
                    <div style={{ fontSize: '0.85rem', color: '#0369A1', marginTop: '0.2rem', fontWeight: 600 }}>
                      ⏰ Target Slot: {new Date(selectedOrderDetails.scheduledPickupAt).toLocaleString()}
                    </div>
                  )}
                  {selectedOrderDetails.estimatedPickupAt && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      Estimated Ready: {new Date(selectedOrderDetails.estimatedPickupAt).toLocaleTimeString()}
                    </div>
                  )}
                  {selectedOrderDetails.expiresAt && (
                    <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '0.2rem' }}>
                      TTL Reservation Expires: {new Date(selectedOrderDetails.expiresAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              {selectedOrderDetails.specialNotes && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E', marginBottom: '0.2rem' }}>
                    📝 Customer Special Instructions:
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#78350F' }}>
                    {selectedOrderDetails.specialNotes}
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.03em' }}>
                  ORDER ITEMS ({(selectedOrderDetails.items || []).length})
                </h4>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#F8F5F0', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>Item</th>
                        <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, textAlign: 'right' }}>Tax</th>
                        <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, textAlign: 'right' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrderDetails.items || []).map((it) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>
                            {it.productNameSnapshot}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 600 }}>
                            {it.quantity}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {formatPaiseToRupees(it.unitPriceSnapshot)}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {it.taxRateSnapshot}%
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: 600 }}>
                            {formatPaiseToRupees(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ minWidth: '240px', background: '#F8F5F0', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Subtotal:</span>
                    <span>{formatPaiseToRupees(selectedOrderDetails.subtotalAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Tax (GST):</span>
                    <span>{formatPaiseToRupees(selectedOrderDetails.taxAmount)}</span>
                  </div>
                  {selectedOrderDetails.packagingAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Packaging:</span>
                      <span>{formatPaiseToRupees(selectedOrderDetails.packagingAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, paddingTop: '0.5rem', marginTop: '0.4rem', borderTop: '1px solid var(--color-border)', color: 'var(--color-brand-primary)' }}>
                    <span>Total Amount:</span>
                    <span>{formatPaiseToRupees(selectedOrderDetails.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer with Operational Action Controls */}
            <div className="modal-footer" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleInspectPayments(selectedOrderDetails)}
                >
                  💳 View Payments
                </button>

                {isManager &&
                  selectedOrderDetails.paymentMethod === 'online_razorpay' &&
                  ['captured', 'partially_refunded'].includes(selectedOrderDetails.paymentStatus) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                      onClick={() => handleOpenRefund(selectedOrderDetails)}
                    >
                      ↩️ Issue Refund
                    </button>
                  )}

                {isManager &&
                  selectedOrderDetails.orderStatus !== 'completed' &&
                  !selectedOrderDetails.orderStatus.startsWith('cancelled') && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleCancelOrder(selectedOrderDetails)}
                    >
                      Cancel Order
                    </button>
                  )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedOrderDetails.orderStatus === 'confirmed' && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#0D6EFD' }}
                    disabled={isActionLoading}
                    onClick={() => handleAdvanceStatus(selectedOrderDetails, 'preparing')}
                  >
                    📦 Mark Order Packed
                  </button>
                )}

                {selectedOrderDetails.orderStatus === 'preparing' && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#198754' }}
                    disabled={isActionLoading}
                    onClick={() => handleAdvanceStatus(selectedOrderDetails, 'ready_for_pickup')}
                  >
                    Ready for Pickup
                  </button>
                )}

                {selectedOrderDetails.orderStatus === 'ready_for_pickup' && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#198754' }}
                    disabled={isActionLoading}
                    onClick={() => {
                      setHandoverOrder(selectedOrderDetails);
                      setCashCollected(selectedOrderDetails.paymentMethod !== 'cash_at_pickup');
                    }}
                  >
                    🤝 Complete Handover
                  </button>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedOrderDetails(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
