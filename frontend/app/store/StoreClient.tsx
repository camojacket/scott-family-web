'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  Grid,
  Badge,
  Alert,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Link from 'next/link';
import { useCart } from '../lib/CartContext';
import type { ProductDto } from '../lib/types';

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const getMinPrice = (product: ProductDto) => {
  const prices = product.variants
    .filter(v => v.active)
    .map(v => v.priceCents ?? product.basePriceCents);
  return prices.length > 0 ? Math.min(...prices) : product.basePriceCents;
};

const getTotalStock = (product: ProductDto) =>
  product.variants.filter(v => v.active).reduce((sum, v) => sum + v.stock, 0);

/** Client wrapper — only exists to provide the cart badge count */
export function CartButton() {
  const { totalItems } = useCart();

  return (
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
        '&:hover': { borderColor: 'var(--color-primary-500)', bgcolor: 'var(--color-primary-50)' },
      }}
    >
      Cart
    </Button>
  );
}

/** Client component that renders the product grid (needs to be client for MUI interactivity) */
export function ProductGrid({ products }: { products: ProductDto[] }) {
  if (products.length === 0) {
    return (
      <Box className="card" sx={{ p: 6, textAlign: 'center' }}>
        <StorefrontIcon sx={{ fontSize: 56, color: 'var(--color-primary-300)', mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
          No products available yet
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Check back soon for reunion shirts and merchandise!
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {products.map(product => {
        const totalStock = getTotalStock(product);
        const soldOut = totalStock === 0;

        return (
          <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: soldOut ? 0.6 : 1,
                transition: 'box-shadow 200ms, transform 200ms',
                '&:hover': soldOut ? {} : {
                  boxShadow: 'var(--shadow-md)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {product.imageUrl ? (
                <CardMedia
                  component="img"
                  height="220"
                  image={product.imageUrl}
                  alt={product.name}
                  sx={{ objectFit: 'cover' }}
                />
              ) : (
                <Box
                  sx={{
                    height: 220,
                    bgcolor: 'var(--color-primary-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StorefrontIcon sx={{ fontSize: 64, color: 'var(--color-primary-200)' }} />
                </Box>
              )}

              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {product.name}
                </Typography>
                {product.description && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--text-secondary)',
                      mb: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {product.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
                    {formatCents(getMinPrice(product))}
                  </Typography>
                  {soldOut && (
                    <Chip label="Sold Out" size="small" color="default" />
                  )}
                </Box>
              </CardContent>

              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  component={Link}
                  href={`/store/${product.id}`}
                  variant="contained"
                  fullWidth
                  disabled={soldOut}
                  sx={{
                    bgcolor: 'var(--color-primary-500)',
                    '&:hover': { bgcolor: 'var(--color-primary-600)' },
                  }}
                >
                  {soldOut ? 'Sold Out' : 'View Details'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

export function StorePageLayout({ products, error }: { products: ProductDto[]; error: string }) {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StorefrontIcon sx={{ fontSize: 36 }} />
            Family Store
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Reunion shirts &amp; merchandise
          </Typography>
        </Box>
        <CartButton />
      </Box>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <ProductGrid products={products} />
      )}
    </Box>
  );
}
