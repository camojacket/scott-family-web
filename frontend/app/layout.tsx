'use client';

// import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Menu,
  MenuItem,
  BottomNavigation,
  BottomNavigationAction,
} from "@mui/material";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// export const metadata: Metadata = {
//   title: "Scott-Phillips Family",
//   description: "Scott-Phillips Family Reunion Website",
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppBar position="static" sx={{ bgcolor: "#333" }}>
          <Toolbar sx={{ flexDirection: "column", textAlign: "center", py: 2 }}>
            <Typography variant="h4" color="white">
              Scott-Phillips Family
            </Typography>
            <Typography variant="subtitle1" color="white">
              Strengthening Family Ties
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ textAlign: "center", my: 2 }}>
          <Image
            src="/images/cropped-marcusandcaroline-1.jpg"
            alt="Marcus and Caroline"
            width={300}
            height={100}
            style={{ objectFit: "cover", borderRadius: "8px" }}
            priority
          />
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, py: 2 }}>
          <Link href="/"><Button>Home</Button></Link>
          <Link href="/blog"><Button>Blog</Button></Link>
          <Link href="/history"><Button>History</Button></Link>
          <Link href="/reunion"><Button>Reunion</Button></Link>
          <Button onClick={handleMenuOpen}>Descendants</Button>
          <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
            {[
              "ellen-scott-phillips",
              "eugene-scott",
              "jeff-scott",
              "jim-scott",
              "joe-scott",
              "mamie-scott-flynn",
              "marcus-a-scott",
              "sandy-scott",
              "willie-scott",
            ].map((descendant) => (
              <MenuItem key={descendant} onClick={handleMenuClose}>
                <Link href={`/ancestry/${descendant}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {descendant.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Link>
              </MenuItem>
            ))}
          </Menu>
          <Link href="/newsletters"><Button>Newsletters</Button></Link>
          <Link href="/memorial"><Button>Memories</Button></Link>
          <Link href="/dues"><Button>Make A Payment</Button></Link>
          <Link href="/contact-us"><Button>Contact Us</Button></Link>
          {/* <Link href="/family-tree"><Button>Family Tree</Button></Link> */}
        </Box>

        <Container maxWidth="md" sx={{ py: 4 }}>
          {children}
        </Container>

        <Box sx={{ py: 3, mt: 4, borderTop: "1px solid #ccc", textAlign: "center" }}>
          <Typography variant="body2" gutterBottom>Follow Us</Typography>
          <BottomNavigation showLabels sx={{ justifyContent: "center", flexWrap: "wrap", gap: 2 }}>
            <BottomNavigationAction
              label="Facebook"
              icon={<Image src="/icons8-facebook.svg" alt="Facebook" width={20} height={20} />}
              component="a"
              href="https://www.facebook.com/groups/551098137231705"
              target="_blank"
            />
            <BottomNavigationAction
              label="Instagram"
              icon={<Image src="/icons8-instagram.svg" alt="Instagram" width={20} height={20} />}
              component="a"
              href="https://instagram.com"
              target="_blank"
            />
            <BottomNavigationAction
              label="X"
              icon={<Image src="/icons8-x.svg" alt="Twitter/X" width={20} height={20} />}
              component="a"
              href="https://twitter.com"
              target="_blank"
            />
          </BottomNavigation>
        </Box>
      </body>
    </html>
  );
}
