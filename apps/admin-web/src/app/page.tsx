'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  type DashboardMetrics,
  type AdminProductItem,
  type AdminCategoryItem,
  type AdminInventoryItem,
  type Order,
  formatPaiseToRupees,
} from '@orange/api-contracts';
import { useAdminAuth } from '../lib/auth';
import {
  fetchDashboardMetrics,
  fetchAdminProducts,
  createAdminProduct,
  updateAdminProduct,
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
} from '../lib/api';

type AdminTab = 'queue' | 'overview' | 'products' | 'categories' | 'inventory';

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
    isVeg: true,
    prepTime: 15,
    initialStock: 10,
    lowStockThreshold: 5,
  });

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

  const [orderFilter, setOrderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Staff Supabase Auth credentials for login screen
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      if (activeTab === 'overview') {
        const d = await fetchDashboardMetrics(token);
        setMetrics(d);
      } else if (activeTab === 'queue') {
        const ords = await fetchAdminOrders(token, { status: orderFilter, search: searchQuery });
        setOrders(ords);
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
    }
  }, [token, activeTab, orderFilter, searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Handle Real Supabase Auth Login
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsLoggingIn(true);
    setLoginErrorMessage(null);
    try {
      const ok = await login(loginEmail.trim(), loginPassword);
      if (!ok) {
        setLoginErrorMessage(authError || 'Failed to authenticate staff credentials.');
      }
    } catch (err: unknown) {
      setLoginErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Quick dev login using standard local Supabase seeded staff accounts
  const handleQuickSeedLogin = async (email: string) => {
    setLoginEmail(email);
    setLoginPassword('password123');
    setIsLoggingIn(true);
    setLoginErrorMessage(null);
    try {
      const ok = await login(email, 'password123');
      if (!ok) {
        setLoginErrorMessage(authError || 'Failed to authenticate staff credentials.');
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
            <span style={{ fontSize: '2.5rem' }}>🍊</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0' }}>Moody Orange</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Staff & Counter Administration Portal</p>
          </div>

          {displayError && (
            <div style={{ padding: '0.75rem', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleStaffLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="staff-email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Staff Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                placeholder="staff@moodyorange.local"
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
                onClick={() => handleQuickSeedLogin('customer@moodyorange.local')}
                title="Verify that customer account is denied access"
              >
                <span>customer@moodyorange.local</span>
                <span className="badge" style={{ background: '#fce4e4', color: '#c0392b' }}>customer (denied)</span>
              </button>
            </div>
          </div>
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
      setHandoverOrder(null);
      setCashCollected(false);
      setStatusMessage(`Order #${handoverOrder.orderNumber} successfully handed over.`);
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
      loadData();
    } catch (e: unknown) {
      alert(`Error cancelling order: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: '#FFF', borderBottom: '1px solid var(--color-border)', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🍊</span>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Moody Orange</h1>
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

          <button type="button" onClick={logout} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
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
        {/* TAB 1: LIVE DISPATCH QUEUE */}
        {/* ========================================================================= */}
        {activeTab === 'queue' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['all', 'confirmed', 'preparing', 'ready_for_pickup', 'completed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderFilter(st)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: orderFilter === st ? 'var(--color-brand-primary)' : '#FFF',
                      color: orderFilter === st ? '#FFF' : 'var(--color-text-main)',
                      border: '1px solid var(--color-border)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '300px', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Search order #, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="button" className="btn-secondary" onClick={loadData}>
                  Refresh
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div style={{ background: '#FFF', padding: '3rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                <p style={{ color: 'var(--color-text-muted)' }}>No orders in this queue filter.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
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
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1rem' }}>#{ord.orderNumber}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className={`badge badge-${ord.orderStatus}`}>
                          {ord.orderStatus.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div style={{ margin: '0.75rem 0', padding: '0.5rem 0', borderTop: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ord.customerName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{ord.customerPhone}</div>
                        {ord.specialNotes && (
                          <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', background: 'var(--color-bg-cream)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                            📝 {ord.specialNotes}
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                          ITEMS ({(ord.items || []).length})
                        </div>
                        {(ord.items || []).map((it) => (
                          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                            <span>{it.quantity}x {it.productNameSnapshot}</span>
                            <span>{formatPaiseToRupees(it.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 1rem 0' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          Total ({ord.paymentMethod === 'cash_at_pickup' ? 'Cash at Counter' : 'Online'})
                        </span>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--color-brand-primary)' }}>
                          {formatPaiseToRupees(ord.totalAmount)}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {ord.orderStatus === 'confirmed' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
                            disabled={isActionLoading}
                            onClick={() => handleAdvanceStatus(ord, 'preparing')}
                          >
                            Start Preparing
                          </button>
                        )}

                        {ord.orderStatus === 'preparing' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', background: '#0D6EFD' }}
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
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', background: '#198754' }}
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
                    setProductForm({
                      name: '',
                      slug: '',
                      categoryId: categories[0]?.id || '',
                      description: '',
                      priceRupees: '',
                      isVeg: true,
                      prepTime: 15,
                      initialStock: 10,
                      lowStockThreshold: 5,
                    });
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
                    <th style={{ padding: '0.75rem 1rem' }}>Veg</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Active</th>
                    {isManager && <th style={{ padding: '0.75rem 1rem' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.slug}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{p.categoryName}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatPaiseToRupees(p.basePrice)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: p.availableStock <= p.lowStockThreshold ? 700 : 400, color: p.availableStock <= p.lowStockThreshold ? '#DC3545' : 'inherit' }}>
                          {p.availableStock}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}> ({p.physicalStock} phys / {p.reservedStock} res)</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{p.isVeg ? '🌱 Veg' : '🥩 Non-Veg'}</td>
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
                                isVeg: p.isVeg,
                                prepTime: p.prepTimeMinutes,
                                initialStock: p.physicalStock,
                                lowStockThreshold: p.lowStockThreshold,
                              });
                              setIsProductModalOpen(true);
                            }}
                          >
                            Edit
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
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

            <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-cream)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Physical Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Reserved (Active Orders)</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Available</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Threshold</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    {isManager && <th style={{ padding: '0.75rem 1rem' }}>Restock</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv) => (
                    <tr key={inv.productId} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <strong>{inv.productName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{inv.categoryName}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{inv.physicalStock}</td>
                      <td style={{ padding: '0.75rem 1rem', color: inv.reservedStock > 0 ? '#B7791F' : 'inherit' }}>
                        {inv.reservedStock}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: inv.isLowStock ? '#DC3545' : 'inherit' }}>
                        {inv.availableStock}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{inv.lowStockThreshold}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {inv.isLowStock ? (
                          <span className="badge badge-cancelled">Low Stock</span>
                        ) : (
                          <span className="badge badge-confirmed">Optimal</span>
                        )}
                      </td>
                      {isManager && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={async () => {
                              if (!token) return;
                              const qtyStr = prompt(`Enter restock units to ADD for ${inv.productName}:`, '10');
                              if (!qtyStr) return;
                              const delta = parseInt(qtyStr, 10);
                              if (isNaN(delta) || delta === 0) return;
                              await adjustAdminInventory(token, {
                                productId: inv.productId,
                                physicalStockDelta: delta,
                                reason: 'Counter restock shipment received',
                              });
                              loadData();
                            }}
                          >
                            + Restock
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
                  value={productForm.categoryId}
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

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={productForm.isVeg}
                  onChange={(e) => setProductForm({ ...productForm, isVeg: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <span style={{ fontSize: '0.85rem' }}>🌱 Vegetarian / Eggless Delicacy</span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  if (!token) return;
                  const pricePaise = Math.round(parseFloat(productForm.priceRupees) * 100);
                  if (isNaN(pricePaise) || pricePaise <= 0) {
                    alert('Please enter a valid price in rupees.');
                    return;
                  }

                  try {
                    if (editingProduct) {
                      await updateAdminProduct(token, editingProduct.id, {
                        name: productForm.name,
                        slug: productForm.slug,
                        categoryId: productForm.categoryId,
                        description: productForm.description,
                        basePrice: pricePaise,
                        isVeg: productForm.isVeg,
                        prepTimeMinutes: productForm.prepTime,
                      });
                    } else {
                      await createAdminProduct(token, {
                        name: productForm.name,
                        slug: productForm.slug,
                        categoryId: productForm.categoryId,
                        description: productForm.description,
                        basePrice: pricePaise,
                        isVeg: productForm.isVeg,
                        prepTimeMinutes: productForm.prepTime,
                        initialStock: productForm.initialStock,
                        lowStockThreshold: productForm.lowStockThreshold,
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
    </div>
  );
}
