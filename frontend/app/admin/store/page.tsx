'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Collapse,

  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ClearIcon from '@mui/icons-material/Clear';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import type { ProductDto, OrderDto } from '../../lib/types';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

export default function AdminStorePage() {
  const [tab, setTab] = useState(0);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  // Product dialog
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);
  const [prodImageUploading, setProdImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prodPrice, setProdPrice] = useState('');
  const [prodSaving, setProdSaving] = useState(false);

  // Variant dialog
  const [variantDialog, setVariantDialog] = useState(false);
  const [variantProductId, setVariantProductId] = useState<number | null>(null);
  const [varSize, setVarSize] = useState('M');
  const [varColor, setVarColor] = useState('');
  const [varPrice, setVarPrice] = useState('');
  const [varStock, setVarStock] = useState('10');
  const [varSaving, setVarSaving] = useState(false);

  // Order filter
  const [orderFilter, setOrderFilter] = useState('');

  const loadProducts = async () => {
    try {
      const p = await apiFetch<ProductDto[]>('/api/store/admin/products');
      setProducts(p);
    } catch { /* ignore */ }
  };

  const loadOrders = async () => {
    try {
      const url = orderFilter
        ? `/api/store/admin/orders?status=${orderFilter}`
        : '/api/store/admin/orders';
      const o = await apiFetch<OrderDto[]>(url);
      setOrders(o);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadOrders()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 1) loadOrders(); }, [tab, orderFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // ── Product CRUD ──

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdDesc('');
    setProdImage('');
    setProdImageFile(null);
    setProdImagePreview(null);
    setProdPrice('');
    setProductDialog(true);
  };

  const openEditProduct = (p: ProductDto) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdDesc(p.description ?? '');
    setProdImage(p.imageUrl ?? '');
    setProdImageFile(null);
    setProdImagePreview(p.imageUrl ?? null);
    setProdPrice((p.basePriceCents / 100).toFixed(2));
    setProductDialog(true);
  };

  const handleSaveProduct = async () => {
    setProdSaving(true);
    try {
      let imageUrl = prodImage;

      // Upload new image file if selected
      if (prodImageFile) {
        setProdImageUploading(true);
        const fd = new FormData();
        fd.append('file', prodImageFile);
        const uploadRes = await apiFetch<{ cdnUrl: string }>('/api/store/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });
        imageUrl = uploadRes.cdnUrl;
        setProdImageUploading(false);
      }

      const priceCents = Math.round(parseFloat(prodPrice) * 100);
      if (editingProduct) {
        await apiFetch(`/api/store/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: { name: prodName, description: prodDesc, imageUrl: imageUrl || null, basePriceCents: priceCents },
        });
      } else {
        await apiFetch('/api/store/admin/products', {
          method: 'POST',
          body: { name: prodName, description: prodDesc, imageUrl: imageUrl || null, basePriceCents: priceCents },
        });
      }
      setProductDialog(false);
      setSnack({ msg: editingProduct ? 'Product updated' : 'Product created', severity: 'success' });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to save product', severity: 'error' });
    } finally {
      setProdSaving(false);
      setProdImageUploading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product and all its variants?')) return;
    try {
      await apiFetch(`/api/store/admin/products/${id}`, { method: 'DELETE' });
      setSnack({ msg: 'Product deleted', severity: 'success' });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to delete product', severity: 'error' });
    }
  };

  const handleToggleProduct = async (p: ProductDto) => {
    try {
      await apiFetch(`/api/store/admin/products/${p.id}`, {
        method: 'PUT',
        body: { active: !p.active },
      });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to update product', severity: 'error' });
    }
  };

  // ── Variant CRUD ──

  const openAddVariant = (productId: number) => {
    setVariantProductId(productId);
    setVarSize('M');
    setVarColor('');
    setVarPrice('');
    setVarStock('10');
    setVariantDialog(true);
  };

  const handleSaveVariant = async () => {
    if (!variantProductId) return;
    setVarSaving(true);
    try {
      await apiFetch(`/api/store/admin/products/${variantProductId}/variants`, {
        method: 'POST',
        body: {
          size: varSize,
          color: varColor || null,
          priceCents: varPrice ? Math.round(parseFloat(varPrice) * 100) : null,
          stock: parseInt(varStock),
        },
      });
      setVariantDialog(false);
      setSnack({ msg: 'Variant added', severity: 'success' });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to add variant', severity: 'error' });
    } finally {
      setVarSaving(false);
    }
  };

  const handleDeleteVariant = async (id: number) => {
    if (!confirm('Delete this variant?')) return;
    try {
      await apiFetch(`/api/store/admin/variants/${id}`, { method: 'DELETE' });
      setSnack({ msg: 'Variant deleted', severity: 'success' });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to delete variant', severity: 'error' });
    }
  };

  const handleUpdateStock = async (variantId: number, stock: number) => {
    try {
      await apiFetch(`/api/store/admin/variants/${variantId}`, {
        method: 'PUT',
        body: { stock },
      });
      loadProducts();
    } catch {
      setSnack({ msg: 'Failed to update stock', severity: 'error' });
    }
  };

  // ── Order management ──

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await apiFetch(`/api/store/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: { status },
      });
      setSnack({ msg: 'Order status updated', severity: 'success' });
      loadOrders();
    } catch {
      setSnack({ msg: 'Failed to update order', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Button component={Link} href="/admin" startIcon={<ArrowBackIcon />} sx={{ color: 'var(--text-secondary)', mb: 1 }}>
        Back to Admin
      </Button>
      <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)', mb: 2 }}>
        Store Management
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Products" icon={<StorefrontIcon />} iconPosition="start" />
        <Tab label="Orders" icon={<LocalShippingIcon />} iconPosition="start" />
      </Tabs>

      {/* ═════════ PRODUCTS TAB ═════════ */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateProduct}
              sx={{ bgcolor: 'var(--color-primary-500)', '&:hover': { bgcolor: 'var(--color-primary-600)' } }}>
              Add Product
            </Button>
          </Box>

          {products.length === 0 ? (
            <Alert severity="info">No products yet. Click &quot;Add Product&quot; to create your first shirt listing.</Alert>
          ) : (
            <Stack spacing={2}>
              {products.map(p => (
                <Box key={p.id} className="card" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {p.imageUrl ? (
                      <Box component="img" src={p.imageUrl} alt={p.name}
                        sx={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--color-primary-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StorefrontIcon sx={{ color: 'var(--color-primary-200)' }} />
                      </Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        Base price: {formatCents(p.basePriceCents)} · {p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Chip
                      label={p.active ? 'Active' : 'Hidden'}
                      size="small"
                      color={p.active ? 'success' : 'default'}
                      variant="outlined"
                      onClick={() => handleToggleProduct(p)}
                      sx={{ cursor: 'pointer' }}
                    />
                    <IconButton size="small" onClick={() => openEditProduct(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDeleteProduct(p.id)} sx={{ color: '#d32f2f' }}><DeleteIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                      {expandedProduct === p.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={expandedProduct === p.id}>
                    <Box sx={{ mt: 2, pl: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Variants (Size / Stock)</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={() => openAddVariant(p.id)}>
                          Add Variant
                        </Button>
                      </Box>

                      {p.variants.length === 0 ? (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                          No variants. Add sizes so customers can order.
                        </Alert>
                      ) : (
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Size</TableCell>
                              <TableCell>Color</TableCell>
                              <TableCell>Price</TableCell>
                              <TableCell>Stock</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {p.variants.map(v => (
                              <TableRow key={v.id}>
                                <TableCell>{v.size}</TableCell>
                                <TableCell>{v.color || '—'}</TableCell>
                                <TableCell>
                                  {v.priceCents != null ? formatCents(v.priceCents) : `(base: ${formatCents(p.basePriceCents)})`}
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <IconButton size="small" onClick={() => handleUpdateStock(v.id, Math.max(0, v.stock - 1))}>
                                      <span style={{ fontWeight: 700, fontSize: 14 }}>−</span>
                                    </IconButton>
                                    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 24, textAlign: 'center' }}>
                                      {v.stock}
                                    </Typography>
                                    <IconButton size="small" onClick={() => handleUpdateStock(v.id, v.stock + 1)}>
                                      <span style={{ fontWeight: 700, fontSize: 14 }}>+</span>
                                    </IconButton>
                                  </Stack>
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton size="small" onClick={() => handleDeleteVariant(v.id)} sx={{ color: '#d32f2f' }}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* ═════════ ORDERS TAB ═════════ */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filter by status</InputLabel>
              <Select label="Filter by status" value={orderFilter} onChange={e => setOrderFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="FULFILLED">Fulfilled</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {orders.length === 0 ? (
            <Alert severity="info">No orders found.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>#{o.id}</TableCell>
                      <TableCell>{o.displayName}</TableCell>
                      <TableCell>
                        {o.items.map(i => `${i.productName} (${i.size}) x${i.quantity}`).join(', ')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatCents(o.totalCents)}</TableCell>
                      <TableCell>
                        <Chip
                          label={o.status}
                          size="small"
                          color={
                            o.status === 'PAID' ? 'success' :
                            o.status === 'FULFILLED' ? 'info' :
                            o.status === 'CANCELLED' ? 'default' : 'warning'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={o.status}
                            onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                            size="small"
                          >
                            <MenuItem value="PENDING">Pending</MenuItem>
                            <MenuItem value="PAID">Paid</MenuItem>
                            <MenuItem value="FULFILLED">Fulfilled</MenuItem>
                            <MenuItem value="CANCELLED">Cancelled</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ═════════ Product Dialog ═════════ */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Product Name" value={prodName} onChange={e => setProdName(e.target.value)} size="small"
              placeholder="e.g., 2026 Reunion T-Shirt" />
            <TextField fullWidth label="Description" value={prodDesc} onChange={e => setProdDesc(e.target.value)} size="small"
              multiline rows={3} placeholder="Describe the shirt design, material, etc." />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'var(--text-secondary)' }}>Product Image</Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProdImageFile(file);
                    setProdImagePreview(URL.createObjectURL(file));
                    setProdImage('');
                  }
                }}
              />
              {prodImagePreview ? (
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Box
                    component="img"
                    src={prodImagePreview}
                    alt="Preview"
                    sx={{ width: 120, height: 120, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border)' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setProdImageFile(null);
                      setProdImagePreview(null);
                      setProdImage('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: '#fce4ec' } }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ textTransform: 'none' }}
                >
                  Choose Image
                </Button>
              )}
              {prodImageUploading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption">Uploading…</Typography>
                </Box>
              )}
            </Box>
            <TextField fullWidth label="Base Price ($)" value={prodPrice} onChange={e => setProdPrice(e.target.value)} size="small"
              type="number" placeholder="25.00" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveProduct} disabled={prodSaving || !prodName || !prodPrice}>
            {prodSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═════════ Variant Dialog ═════════ */}
      <Dialog open={variantDialog} onClose={() => setVariantDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Size Variant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Size</InputLabel>
              <Select label="Size" value={varSize} onChange={e => setVarSize(e.target.value)}>
                {SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Color (optional)" value={varColor} onChange={e => setVarColor(e.target.value)} size="small" />
            <TextField fullWidth label="Price Override ($, leave blank for base price)" value={varPrice}
              onChange={e => setVarPrice(e.target.value)} size="small" type="number" />
            <TextField fullWidth label="Stock Quantity" value={varStock} onChange={e => setVarStock(e.target.value)} size="small"
              type="number" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariantDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveVariant} disabled={varSaving}>
            {varSaving ? 'Saving...' : 'Add Variant'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">{snack.msg}</Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
