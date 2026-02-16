'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from '../../components/CdnImage';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CancelIcon from '@mui/icons-material/Cancel';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useCart } from '../../lib/CartContext';
import type { OrderDto } from '../../lib/types';

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalCents, totalItems } = useCart();
  const [placing, setPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderDto | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const pollingRef = useRef(false);

  // Cancel flow
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Order history
  const [myOrders, setMyOrders] = useState<OrderDto[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // ── Handle return from Square checkout ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    if (params.get('status') === 'paid' && orderId) {
      window.history.replaceState({}, '', '/store/cart');
      setVerifying(true);
      pollingRef.current = true;
      clearCart(); // Cart items were already submitted as an order

      const poll = async () => {
        const maxAttempts = 15;
        for (let i = 0; i < maxAttempts && pollingRef.current; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const orders = await apiFetch<OrderDto[]>('/api/store/orders/mine');
            const order = orders.find(o => String(o.id) === orderId);
            if (order && order.status === 'PAID') {
              setOrderResult(order);
              setVerifying(false);
              pollingRef.current = false;
              setSnack({ msg: 'Order placed successfully!', severity: 'success' });
              return;
            }
          } catch { /* continue polling */ }
        }
        setVerifying(false);
        pollingRef.current = false;
        setSnack({
          msg: 'Your payment is being processed. Check your orders for confirmation.',
          severity: 'info',
        });
      };
      poll();
    }
    return () => { pollingRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = async () => {
    setPlacing(true);
    try {
      let orderId = pendingOrderId;

      // Step 1: Create order (with idempotency key to prevent duplicates on retry)
      if (!orderId) {
        const idempotencyKey = crypto.randomUUID();
        const order = await apiFetch<OrderDto>('/api/store/orders', {
          method: 'POST',
          body: {
            items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
            notes: null,
            idempotencyKey,
          },
        });
        orderId = order.id;
        setPendingOrderId(orderId); // Save so retries don't create new orders
      }

      // Step 2: Create Square Checkout payment link and redirect
      const res = await fetch('/api/square/order-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          items: items.map(i => ({
            name: `${i.productName} (${i.size}${i.color ? `, ${i.color}` : ''})`,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Checkout failed' }));
        throw new Error(data.error || 'Failed to create checkout');
      }

      const { checkoutUrl } = await res.json();
      if (!checkoutUrl) throw new Error('No checkout URL returned');

      // Step 3: Redirect to Square-hosted checkout page
      window.location.href = checkoutUrl;
      return; // Page will unload
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place order';
      setSnack({ msg: message, severity: 'error' });
    } finally {
      setPlacing(false);
    }
  };

  // ── Cancel order ──
  const handleCancelOrder = async () => {
    if (!orderResult) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/store/orders/${orderResult.id}/cancel`, { method: 'POST' });
      setSnack({ msg: 'Order cancelled successfully.', severity: 'success' });
      setOrderResult(null);
      loadMyOrders();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order';
      setSnack({ msg: message, severity: 'error' });
    } finally {
      setCancelling(false);
      setCancelDialog(false);
    }
  };

  // ── Load order history ──
  const loadMyOrders = async () => {
    setLoadingOrders(true);
    try {
      const orders = await apiFetch<OrderDto[]>('/api/store/orders/mine');
      setMyOrders(orders);
    } catch { /* ignore - not logged in */ }
    finally { setLoadingOrders(false); }
  };

  useEffect(() => {
    loadMyOrders();
  }, []);

  // ── Payment verification view ──
  if (verifying) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Box className="card" sx={{ p: 6 }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Confirming your payment&hellip;
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Please wait while we verify your payment with Square.
          </Typography>
        </Box>
      </Box>
    );
  }

  // ── Order confirmation view ──
  if (orderResult) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Box className="card" sx={{ p: { xs: 3, sm: 5 } }}>
          <ShoppingCartIcon sx={{ fontSize: 56, color: '#2e7d32', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>
            Order Placed!
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', mb: 3 }}>
            Order #{orderResult.id} &mdash; {formatCents(orderResult.totalCents)}
          </Typography>

          <Stack spacing={1} sx={{ textAlign: 'left', mb: 3 }}>
            {orderResult.items.map(item => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  {item.productName} ({item.size}{item.color ? `, ${item.color}` : ''}) x{item.quantity}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatCents(item.unitPriceCents * item.quantity)}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              component={Link}
              href="/store"
              variant="contained"
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
              }}
            >
              Continue Shopping
            </Button>

            {orderResult.status === 'PAID' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={cancelling ? <CircularProgress size={16} /> : <CancelIcon />}
                onClick={() => setCancelDialog(true)}
                disabled={cancelling}
              >
                Cancel Order
              </Button>
            )}
          </Stack>

          {orderResult.status === 'PAID' && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 2 }}>
              You can cancel this order before it ships. A refund will be issued to your original payment method.
            </Typography>
          )}
        </Box>

        {/* Cancel confirmation dialog */}
        <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)}>
          <DialogTitle>Cancel Order #{orderResult.id}?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to cancel this order? This cannot be undone.
              A refund of {formatCents(orderResult.totalCents)} will be issued.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialog(false)} disabled={cancelling}>Keep Order</Button>
            <Button
              onClick={handleCancelOrder}
              color="error"
              variant="contained"
              disabled={cancelling}
              startIcon={cancelling ? <CircularProgress size={16} /> : undefined}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ── Empty cart view ──
  if (items.length === 0) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', py: { xs: 3, sm: 5 } }}>
        <Box className="card" sx={{ p: 6, textAlign: 'center' }}>
          <ShoppingCartIcon sx={{ fontSize: 56, color: 'var(--color-primary-300)', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
            Your cart is empty
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>
            Browse the store to find reunion shirts and merchandise.
          </Typography>
          <Button
            component={Link}
            href="/store"
            variant="contained"
            startIcon={<StorefrontIcon />}
            sx={{
              bgcolor: 'var(--color-primary-500)',
              '&:hover': { bgcolor: 'var(--color-primary-600)' },
            }}
          >
            Browse Store
          </Button>
        </Box>

        {/* Order History */}
        {myOrders.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              My Orders
            </Typography>
            <Stack spacing={2}>
              {myOrders.map(order => (
                <OrderHistoryCard
                  key={order.id}
                  order={order}
                  formatCents={formatCents}
                  onCancel={async (id) => {
                    try {
                      await apiFetch(`/api/store/orders/${id}/cancel`, { method: 'POST' });
                      setSnack({ msg: 'Order cancelled.', severity: 'success' });
                      loadMyOrders();
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Failed to cancel';
                      setSnack({ msg, severity: 'error' });
                    }
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        {loadingOrders && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        <Snackbar
          open={!!snack}
          autoHideDuration={4000}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {snack ? (
            <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
              {snack.msg}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Box>
    );
  }

  // ── Cart with items ──
  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Shopping Cart
        </Typography>
        <Button
          component={Link}
          href="/store"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'var(--text-secondary)' }}
        >
          Continue Shopping
        </Button>
      </Box>

      <Box className="card" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack divider={<Divider />} spacing={0}>
          {items.map(item => (
            <Box
              key={item.variantId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 2,
              }}
            >
              {/* Product image */}
              {item.imageUrl ? (
                <Box sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 'var(--radius-sm)',
                    bgcolor: 'var(--color-primary-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <StorefrontIcon sx={{ color: 'var(--color-primary-200)' }} />
                </Box>
              )}

              {/* Details */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.productName}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  Size: {item.size}{item.color ? ` | Color: ${item.color}` : ''}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-primary-600)' }}>
                  {formatCents(item.unitPriceCents)} each
                </Typography>
              </Box>

              {/* Quantity controls */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton size="small" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontWeight: 600, minWidth: 24, textAlign: 'center' }}>
                  {item.quantity}
                </Typography>
                <IconButton size="small" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>

              {/* Line total */}
              <Typography sx={{ fontWeight: 700, minWidth: 70, textAlign: 'right' }}>
                {formatCents(item.unitPriceCents * item.quantity)}
              </Typography>

              {/* Remove */}
              <IconButton
                size="small"
                onClick={() => removeItem(item.variantId)}
                sx={{ color: 'var(--color-error-500)' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Total */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Total ({totalItems} item{totalItems !== 1 ? 's' : ''})
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
            {formatCents(totalCents)}
          </Typography>
        </Box>

        {/* Square checkout redirect */}

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleCheckout}
          disabled={placing}
          startIcon={placing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PaymentIcon />}
          sx={{
            bgcolor: 'var(--color-primary-500)',
            '&:hover': { bgcolor: 'var(--color-primary-600)' },
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {placing ? 'Redirecting to Square...' : `Checkout — ${formatCents(totalCents)}`}
        </Button>

        <Alert severity="info" sx={{ mt: 2, borderRadius: 'var(--radius-md)' }}>
          <Typography variant="body2">
            Payments are processed securely through Square&apos;s hosted checkout.
          </Typography>
        </Alert>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

// ── Order History Card ──

function OrderHistoryCard({
  order,
  formatCents,
  onCancel,
}: {
  order: OrderDto;
  formatCents: (c: number) => string;
  onCancel: (id: number) => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const statusColor = (s: string) => {
    switch (s) {
      case 'PAID': return 'success' as const;
      case 'FULFILLED': return 'info' as const;
      case 'CANCELLED': return 'default' as const;
      case 'REFUNDED': return 'secondary' as const;
      case 'REQUIRES_REFUND': return 'warning' as const;
      default: return 'warning' as const;
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    await onCancel(order.id);
    setCancelling(false);
    setConfirmOpen(false);
  };

  return (
    <Box className="card" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>
          Order #{order.id}
        </Typography>
        <Chip
          label={order.status.replace('_', ' ')}
          size="small"
          color={statusColor(order.status)}
          variant="outlined"
        />
      </Box>

      <Stack spacing={0.5} sx={{ mb: 1 }}>
        {order.items.map(item => (
          <Typography key={item.id} variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            {item.productName} ({item.size}{item.color ? `, ${item.color}` : ''}) x{item.quantity}
            {' '}&mdash; {formatCents(item.unitPriceCents * item.quantity)}
          </Typography>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}
          {' '}&bull; Total: <strong>{formatCents(order.totalCents)}</strong>
        </Typography>

        {order.status === 'PAID' && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={cancelling ? <CircularProgress size={14} /> : <CancelIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={cancelling}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
        )}
      </Box>

      {order.squareReceiptUrl && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          <a href={order.squareReceiptUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--color-primary-500)' }}>
            View Receipt
          </a>
        </Typography>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Cancel Order #{order.id}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure? A refund of {formatCents(order.totalCents)} will be issued.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={cancelling}>Keep Order</Button>
          <Button onClick={handleCancel} color="error" variant="contained" disabled={cancelling}
            startIcon={cancelling ? <CircularProgress size={16} /> : undefined}>
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}