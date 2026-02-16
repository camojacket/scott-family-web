'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import { apiFetch } from '../lib/api';
import dynamic from 'next/dynamic';

// Lazy-load TiptapEditor (only needed when admin opens reply)
const TiptapEditor = dynamic(() => import('../blog/TiptapEditor'), { ssr: false });

// ─── Types ───────────────────────────────────────────────

type InquirySummary = {
  id: number;
  name: string;
  email: string;
  messagePreview: string;
  submittedAt: string;
  read: boolean;
  status: string;
  userId: number | null;
};

type ReplyItem = {
  id: number;
  senderType: 'ADMIN' | 'USER';
  senderUserId: number;
  senderDisplayName: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type InquiryDetail = {
  id: number;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
  read: boolean;
  status: string;
  userId: number | null;
  replies: ReplyItem[];
};

const PAGE_SIZES = [10, 25, 50];

export default function AdminInquiriesTab() {
  // ─── Data state ────────────────────────────────────
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Filtering / sorting ───────────────────────────
  const [statusTab, setStatusTab] = useState(0); // 0 = OPEN, 1 = RESPONDED
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ─── Pagination ────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);

  // ─── Detail overlay ────────────────────────────────
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Reply editor ──────────────────────────────────
  const [replyHtml, setReplyHtml] = useState('');
  const [sending, setSending] = useState(false);

  const statusFilter = statusTab === 0 ? 'OPEN' : 'RESPONDED';

  // ─── Load inquiries ────────────────────────────────
  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<InquirySummary[]>(`/api/admin/inquiries?${params}`);
      setInquiries(res);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to load inquiries' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortDir, search]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  // ─── Pagination helpers ────────────────────────────
  const pagedInquiries = useMemo(() => {
    const start = page * rowsPerPage;
    return inquiries.slice(start, start + rowsPerPage);
  }, [inquiries, page, rowsPerPage]);

  // ─── Open detail overlay ───────────────────────────
  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setReplyHtml('');
    try {
      const res = await apiFetch<InquiryDetail>(`/api/admin/inquiries/${id}`);
      setSelectedInquiry(res);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to load inquiry detail' });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Send reply ────────────────────────────────────
  const handleSendReply = async () => {
    if (!selectedInquiry || !replyHtml.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/inquiries/${selectedInquiry.id}/reply`, {
        method: 'POST',
        body: { body: replyHtml },
      });
      // Refresh the detail
      const res = await apiFetch<InquiryDetail>(`/api/admin/inquiries/${selectedInquiry.id}`);
      setSelectedInquiry(res);
      setReplyHtml('');
      setMsg({ type: 'success', text: 'Reply sent and email delivered!' });
      // Refresh list
      loadInquiries();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to send reply' });
    } finally {
      setSending(false);
    }
  };

  // ─── Sort handler ──────────────────────────────────
  const handleSort = (field: 'date' | 'name') => {
    if (sortBy === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  return (
    <Box>
      {/* Sub-tabs: Open | Responded */}
      <Tabs
        value={statusTab}
        onChange={(_, v) => { setStatusTab(v); setPage(0); }}
        sx={{ mb: 2 }}
      >
        <Tab label="Open" />
        <Tab label="Responded" />
      </Tabs>

      {/* Search + info */}
      <Toolbar disableGutters sx={{ gap: 2, flexWrap: 'wrap', mb: 2, justifyContent: 'space-between' }}>
        <TextField
          size="small"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
          sx={{ minWidth: 280 }}
        />
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
          Messages older than 60 days are automatically deleted.
        </Typography>
      </Toolbar>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'name'}
                      direction={sortBy === 'name' ? sortDir : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'date'}
                      direction={sortBy === 'date' ? sortDir : 'desc'}
                      onClick={() => handleSort('date')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Message Preview</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedInquiries.map(inq => (
                  <TableRow
                    key={inq.id}
                    hover
                    sx={{ cursor: 'pointer', fontWeight: inq.read ? 400 : 700 }}
                    onClick={() => openDetail(inq.id)}
                  >
                    <TableCell sx={{ fontWeight: inq.read ? 400 : 700 }}>{inq.name}</TableCell>
                    <TableCell>{new Date(inq.submittedAt).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inq.messagePreview}
                    </TableCell>
                    <TableCell>{inq.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={inq.status}
                        size="small"
                        color={inq.status === 'OPEN' ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {pagedInquiries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No {statusFilter.toLowerCase()} inquiries</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={inquiries.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={PAGE_SIZES}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          />
        </>
      )}

      {/* ─── Detail / Thread Overlay ───────────────────── */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-lg, 12px)',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Inquiry Details</Typography>
          <IconButton onClick={() => setDetailOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : selectedInquiry ? (
            <Box>
              {/* Header info */}
              <Box sx={{ display: 'flex', gap: 4, mb: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">From</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{selectedInquiry.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{selectedInquiry.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    {new Date(selectedInquiry.submittedAt).toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip
                      label={selectedInquiry.status}
                      size="small"
                      color={selectedInquiry.status === 'OPEN' ? 'warning' : 'success'}
                    />
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Conversation thread — chat bubble style */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3, maxHeight: 400, overflowY: 'auto', p: 1 }}>
                {/* Original message */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Box sx={{
                    maxWidth: '75%',
                    bgcolor: '#f0f0f0', //'var(--color-gray-100, #f0f0f0)',
                    borderRadius: '12px 12px 12px 4px',
                    p: 2,
                  }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {selectedInquiry.name} (original message)
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      {selectedInquiry.message}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled', textAlign: 'right' }}>
                      {new Date(selectedInquiry.submittedAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* Replies */}
                {selectedInquiry.replies.map(reply => {
                  const isAdmin = reply.senderType === 'ADMIN';
                  return (
                    <Box key={reply.id} sx={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                      <Box sx={{
                        maxWidth: '75%',
                        bgcolor: isAdmin ? 'var(--color-primary-50, #e3f2fd)' : '#f0f0f0',
                        borderRadius: isAdmin ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        p: 2,
                        border: isAdmin ? '1px solid var(--color-primary-200, #90caf9)' : 'none',
                      }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {reply.senderDisplayName} ({isAdmin ? 'Admin' : 'User'})
                        </Typography>
                        {isAdmin ? (
                          <Box
                            sx={{ mt: 0.5, fontSize: 14, lineHeight: 1.6, '& p': { m: 0 }, '& img': { maxWidth: '100%' } }}
                            dangerouslySetInnerHTML={{ __html: reply.body }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {reply.body}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled', textAlign: 'right' }}>
                          {new Date(reply.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Reply editor */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Reply</Typography>
              <TiptapEditor value={replyHtml} onChange={setReplyHtml} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  disabled={sending || !replyHtml.trim() || replyHtml === '<p></p>'}
                  onClick={handleSendReply}
                  sx={{ bgcolor: 'var(--color-primary-500)', '&:hover': { bgcolor: 'var(--color-primary-600)' } }}
                >
                  {sending ? 'Sending…' : 'Send Reply & Email'}
                </Button>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
