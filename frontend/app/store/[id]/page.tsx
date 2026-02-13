'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,

  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Snackbar,
  IconButton,
  Badge,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useCart } from '../../lib/CartContext';
import type { ProductDto, ProductVariantDto } from '../../lib/types';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem, totalItems } = useCart();
  const productId = params.id as string;

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDto | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    apiFetch<ProductDto>(`/api/store/products/${productId}`)
      .then(p => {
        setProduct(p);
        // Auto-select first in-stock variant
        const firstAvailable = p.variants.find(v => v.active && v.stock > 0);
        if (firstAvailable) setSelectedVariant(firstAvailable);
      })
      .catch(() => router.push('/store'))
      .finally(() => setLoading(false));
  }, [productId, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product) return null;

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const unitPrice = selectedVariant?.priceCents ?? product.basePriceCents;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      quantity,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      size: selectedVariant.size,
      color: selectedVariant.color,
      unitPriceCents: unitPrice,
    });
    setSnack({ msg: `Added ${product.name} (${selectedVariant.size}) to cart!`, severity: 'success' });
    setQuantity(1);
  };

  // Group available sizes
  const activeVariants = product.variants.filter(v => v.active);
  const sizes = [...new Set(activeVariants.map(v => v.size))];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Back + Cart header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          component={Link}
          href="/store"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'var(--text-secondary)' }}
        >
          Back to Store
        </Button>
        <Button
          component={Link}
          href="/store/cart"
          variant="outlined"
          startIcon={
            <Badge badgeContent={totalItems} color="primary">
              <ShoppingCartIcon />
            </Badge>
          }
          sx={{
            borderColor: 'var(--color-primary-300)',
            color: 'var(--color-primary-600)',
          }}
        >
          Cart
        </Button>
      </Box>

      <Box className="card" sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }}>
          {/* Image */}
          {product.imageUrl ? (
            <Box
              component="img"
              src={product.imageUrl}
              alt={product.name}
              sx={{
                width: { xs: '100%', md: 380 },
                height: { xs: 300, md: 'auto' },
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                width: { xs: '100%', md: 380 },
                height: { xs: 300, md: 380 },
                bgcolor: 'var(--color-primary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorefrontIcon sx={{ fontSize: 80, color: 'var(--color-primary-200)' }} />
            </Box>
          )}

          {/* Details */}
          <Box sx={{ flex: 1, p: { xs: 3, sm: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {product.name}
            </Typography>

            {product.description && (
              <Typography sx={{ color: 'var(--text-secondary)', mb: 3, lineHeight: 1.7 }}>
                {product.description}
              </Typography>
            )}

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)', mb: 3 }}>
              {formatCents(unitPrice)}
            </Typography>

            {/* Size selector */}
            {sizes.length > 0 && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Size</InputLabel>
                <Select
                  label="Size"
                  value={selectedVariant?.id ?? ''}
                  onChange={(e) => {
                    const v = activeVariants.find(v => v.id === Number(e.target.value));
                    setSelectedVariant(v || null);
                    setQuantity(1);
                  }}
                >
                  {activeVariants.map(v => (
                    <MenuItem key={v.id} value={v.id} disabled={v.stock === 0}>
                      {v.size}{v.color ? ` — ${v.color}` : ''}
                      {v.stock === 0 ? ' (Sold Out)' : ` (${v.stock} left)`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Quantity */}
            {selectedVariant && selectedVariant.stock > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
                  Quantity
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <RemoveIcon />
                  </IconButton>
                  <Typography sx={{ fontWeight: 600, minWidth: 32, textAlign: 'center' }}>
                    {quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(q => Math.min(selectedVariant.stock, q + 1))}
                    disabled={quantity >= selectedVariant.stock}
                  >
                    <AddIcon />
                  </IconButton>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)', ml: 1 }}>
                    {selectedVariant.stock} available
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Add to cart */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant.stock === 0}
              startIcon={<AddShoppingCartIcon />}
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {!selectedVariant
                ? 'Select a size'
                : selectedVariant.stock === 0
                  ? 'Sold Out'
                  : `Add to Cart — ${formatCents(unitPrice * quantity)}`}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
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
