'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
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
import Image from '../../components/CdnImage';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import Link from 'next/link';
import { useCart } from '../../lib/CartContext';
import type { ProductDto, ProductVariantDto } from '../../lib/types';

export default function ProductDetailClient({ product }: { product: ProductDto }) {
  const { addItem, totalItems } = useCart();

  const activeVariants = product.variants.filter(v => v.active);
  const firstAvailable = activeVariants.find(v => v.stock > 0) ?? null;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDto | null>(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

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
          {/* Image — now uses next/image for optimization */}
          {product.imageUrl ? (
            <Box sx={{ position: 'relative', width: { xs: '100%', md: 380 }, height: { xs: 300, md: 380 } }}>
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 900px) 100vw, 380px"
                style={{ objectFit: 'cover' }}
                priority
              />
            </Box>
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
