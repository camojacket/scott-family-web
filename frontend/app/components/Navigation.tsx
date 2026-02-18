'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Menu,
  MenuItem,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Container,
  Stack,
  Fade,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import HistoryIcon from '@mui/icons-material/History';
import CelebrationIcon from '@mui/icons-material/Celebration';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import PaymentIcon from '@mui/icons-material/Payment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MailIcon from '@mui/icons-material/Mail';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Collapse from '@mui/material/Collapse';
import FacebookIcon from '@mui/icons-material/Facebook';

import InstagramIcon from '@mui/icons-material/Instagram';
import CloseIcon from '@mui/icons-material/Close';
import ErrorBoundary from './ErrorBoundary';
import AnnouncementBanner from './AnnouncementBanner';
import NotificationBell from './NotificationBell';
import SessionTimeoutDialog from './SessionTimeoutDialog';
import { useSessionTimeout } from '../lib/useSessionTimeout';
import { useFamilyName } from '../lib/FamilyNameContext';

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_LINKS: NavLink[] = [
  { href: '/',             label: 'Home',           icon: <HomeIcon fontSize="small" /> },
  { href: '/blog',         label: 'Blog',           icon: <ArticleIcon fontSize="small" /> },
  // History is handled as a dropdown, not a direct link
  { href: '/reunion',      label: 'Reunion',        icon: <CelebrationIcon fontSize="small" /> },
  { href: '/newsletters',  label: 'Newsletters',    icon: <NewspaperIcon fontSize="small" /> },
  { href: '/memorial',     label: 'Gallery',        icon: <PhotoLibraryIcon fontSize="small" /> },
  { href: '/dues',         label: 'Payments',       icon: <PaymentIcon fontSize="small" /> },
  { href: '/store',        label: 'Store',          icon: <StorefrontIcon fontSize="small" /> },
  { href: '/contact-us',   label: 'Contact',        icon: <MailIcon fontSize="small" /> },
  { href: '/family-tree',  label: 'Family Tree',    icon: <AccountTreeIcon fontSize="small" /> },
  { href: '/profile',      label: 'Profile',        icon: <PersonIcon fontSize="small" /> },
];

export default function Navigation({ children }: { children: React.ReactNode }) {
  const { family, full } = useFamilyName();

  // History dropdown menu state
  const [historyAnchorEl, setHistoryAnchorEl] = useState<null | HTMLElement>(null);
  const historyOpen = Boolean(historyAnchorEl);
  const handleHistoryMenuOpen = (e: React.MouseEvent<HTMLElement>) => setHistoryAnchorEl(e.currentTarget as HTMLElement);
  const handleHistoryMenuClose = () => setHistoryAnchorEl(null);

  // History mobile expand state
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Mobile drawer state
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scroll state for navbar shadow
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 960);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { isAdmin } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Session timeout management
  const sessionTimeout = useSessionTimeout();

  useEffect(() => {
    const readProfile = () => {
      try {
        const raw = localStorage.getItem('profile');
        if (!raw) {
          setIsLoggedIn(false);
          setAuthChecked(true);
          return;
        }
        setIsLoggedIn(true);
        setAuthChecked(true);
      } catch {
        setIsLoggedIn(false);
        setAuthChecked(true);
      }
    };

    readProfile();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'profile') readProfile();
    };
    const onFocus = () => readProfile();
    const onProfileUpdated = () => readProfile();

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    window.addEventListener('profile-updated', onProfileUpdated as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('profile-updated', onProfileUpdated as EventListener);
    };
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Hero Header ────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 40%, #1976d2 100%)',
          color: '#fff',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          pb: 3,
          pt: 4,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.08) 0%, transparent 60%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.6rem', sm: '2rem' },
              textShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {family}
          </Typography>
          <Typography
            sx={{
              mt: 0.5,
              opacity: 0.85,
              fontWeight: 400,
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Strengthening Family Ties
          </Typography>
        </Container>
      </Box>

      {/* ── Navigation Bar ─────────────────────────────────────── */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: '#fff',
          color: 'var(--color-gray-800)',
          borderBottom: '1px solid',
          borderColor: scrolled ? 'var(--border)' : 'transparent',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
          transition: 'all 250ms ease',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: 52, sm: 56 }, gap: 0.5 }}>
            {!authChecked ? (
              /* Show nothing until auth state is determined */
              <Box sx={{ width: '100%', minHeight: 36 }} />
            ) : !isLoggedIn ? (
              <Stack direction="row" spacing={1.5} sx={{ width: '100%', justifyContent: 'center' }}>
                <Link href="/login">
                  <Button
                    variant="contained"
                    sx={{
                      bgcolor: 'var(--color-primary-500)',
                      '&:hover': { bgcolor: 'var(--color-primary-600)' },
                      px: 4,
                    }}
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    variant="outlined"
                    sx={{
                      borderColor: 'var(--color-primary-500)',
                      color: 'var(--color-primary-500)',
                      '&:hover': { borderColor: 'var(--color-primary-600)', bgcolor: 'var(--color-primary-50)' },
                      px: 4,
                    }}
                  >
                    Sign Up
                  </Button>
                </Link>
              </Stack>
            ) : isMobile ? (
              /* Mobile: hamburger */
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>
                  Menu
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <NotificationBell />
                  <IconButton
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open navigation menu"
                    sx={{ color: 'var(--color-primary-600)' }}
                  >
                    <MenuIcon />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              /* Desktop: horizontal nav */
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                {NAV_LINKS.map((link) => (
                  <Button
                    key={link.href}
                    component={Link}
                    href={link.href}
                    size="small"
                    sx={{
                      color: 'var(--color-gray-700)',
                      fontWeight: 500,
                      fontSize: '0.82rem',
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 'var(--radius-sm)',
                      '&:hover': {
                        bgcolor: 'var(--color-primary-50)',
                        color: 'var(--color-primary-600)',
                      },
                    }}
                  >
                    {link.label}
                  </Button>
                ))}

                {/* History dropdown */}
                <Button
                  onClick={handleHistoryMenuOpen}
                  endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '1rem !important' }} />}
                  size="small"
                  sx={{
                    color: 'var(--color-gray-700)',
                    fontWeight: 500,
                    fontSize: '0.82rem',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 'var(--radius-sm)',
                    '&:hover': { bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-600)' },
                  }}
                >
                  History
                </Button>

                {isAdmin && (
                  <Button
                    component={Link}
                    href="/admin"
                    size="small"
                    startIcon={<AdminPanelSettingsIcon sx={{ fontSize: '1rem !important' }} />}
                    sx={{
                      color: 'var(--color-accent-600)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 'var(--radius-sm)',
                      '&:hover': { bgcolor: '#fff8e1' },
                    }}
                  >
                    Admin
                  </Button>
                )}

                {/* Notification bell for logged-in users */}
                <NotificationBell />
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* ── Mobile Drawer ──────────────────────────────────────── */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            borderRadius: '0 var(--radius-xl) var(--radius-xl) 0',
          },
        }}
      >
        <Box sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0d47a1, #1976d2)',
          color: '#fff',
        }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {full}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Family Navigation
            </Typography>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ pt: 1 }}>
          {NAV_LINKS.map((link) => (
            <ListItemButton
              key={link.href}
              component={Link}
              href={link.href}
              onClick={() => setDrawerOpen(false)}
              sx={{
                mx: 1,
                borderRadius: 'var(--radius-sm)',
                mb: 0.25,
                '&:hover': { bgcolor: 'var(--color-primary-50)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'var(--color-primary-500)' }}>
                {link.icon}
              </ListItemIcon>
              <ListItemText
                primary={link.label}
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
              />
            </ListItemButton>
          ))}

          {/* History expandable section in drawer */}
          <ListItemButton
            onClick={() => setHistoryExpanded(!historyExpanded)}
            sx={{ mx: 1, borderRadius: 'var(--radius-sm)', mb: 0.25, '&:hover': { bgcolor: 'var(--color-primary-50)' } }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'var(--color-primary-500)' }}>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="History"
              primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
            />
            {historyExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </ListItemButton>
          <Collapse in={historyExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton
                component={Link}
                href="/history"
                onClick={() => setDrawerOpen(false)}
                sx={{ pl: 7, mx: 1, borderRadius: 'var(--radius-sm)', mb: 0.25, '&:hover': { bgcolor: 'var(--color-primary-50)' } }}
              >
                <ListItemText
                  primary="Our Story"
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                />
              </ListItemButton>
              <ListItemButton
                component={Link}
                href="/history/family-artifacts"
                onClick={() => setDrawerOpen(false)}
                sx={{ pl: 7, mx: 1, borderRadius: 'var(--radius-sm)', mb: 0.25, '&:hover': { bgcolor: 'var(--color-primary-50)' } }}
              >
                <ListItemText
                  primary="Family Artifacts"
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                />
              </ListItemButton>
              <ListItemButton
                component={Link}
                href="/history/obituaries"
                onClick={() => setDrawerOpen(false)}
                sx={{ pl: 7, mx: 1, borderRadius: 'var(--radius-sm)', mb: 0.25, '&:hover': { bgcolor: 'var(--color-primary-50)' } }}
              >
                <ListItemText
                  primary="Obituaries"
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                />
              </ListItemButton>
            </List>
          </Collapse>

          <Divider sx={{ my: 1 }} />
          {isAdmin && (
            <ListItemButton
              component={Link}
              href="/admin"
              onClick={() => setDrawerOpen(false)}
              sx={{ mx: 1, borderRadius: 'var(--radius-sm)', '&:hover': { bgcolor: '#fff8e1' } }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'var(--color-accent-600)' }}>
                <AdminPanelSettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Admin"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-accent-600)' }}
              />
            </ListItemButton>
          )}
        </List>
      </Drawer>

      {/* History dropdown — shared between mobile & desktop */}
      <Menu
        anchorEl={historyAnchorEl}
        open={historyOpen}
        onClose={handleHistoryMenuClose}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            mt: 0.5,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
            minWidth: 220,
          },
        }}
      >
        <MenuItem
          onClick={handleHistoryMenuClose}
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' },
          }}
        >
          <Link
            href="/history"
            style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
          >
            Our Story
          </Link>
        </MenuItem>
        <MenuItem
          onClick={handleHistoryMenuClose}
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' },
          }}
        >
          <Link
            href="/history/family-artifacts"
            style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
          >
            Family Artifacts
          </Link>
        </MenuItem>
        <MenuItem
          onClick={handleHistoryMenuClose}
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' },
          }}
        >
          <Link
            href="/history/obituaries"
            style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
          >
            Obituaries
          </Link>
        </MenuItem>
      </Menu>

      {/* ── Announcement Banner ────────────────────────────────── */}
      {isLoggedIn && <AnnouncementBanner />}

      {/* ── Page Content ───────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flex: 1,
          maxWidth: 960,
          width: '100%',
          mx: 'auto',
          py: { xs: 3, sm: 5 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </Box>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <Box
        component="footer"
        sx={{
          background: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)',
          color: '#fff',
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              py: 4,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
                {family}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Strengthening Family Ties since 1926
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <IconButton
                component="a"
                href="https://www.facebook.com/groups/551098137231705"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
                size="small"
              >
                <FacebookIcon fontSize="small" />
              </IconButton>
              <IconButton
                component="a"
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
                size="small"
              >
                <InstagramIcon fontSize="small" />
              </IconButton>
              <IconButton
                component="a"
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
                size="small"
              >
                <Image src="/icons8-x.svg" alt="X" width={16} height={16} style={{ filter: 'brightness(10)' }} />
              </IconButton>
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              &copy; {new Date().getFullYear()} {family}. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Session timeout warning dialog */}
      <SessionTimeoutDialog session={sessionTimeout} />
    </Box>
  );
}
