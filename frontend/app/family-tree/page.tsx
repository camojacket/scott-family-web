'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Box, CircularProgress, Typography, Link as MUILink, IconButton, Tooltip,
  TextField, InputAdornment, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Stack, Autocomplete, MenuItem,
} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import NextLink from 'next/link';
import { apiFetch } from '../lib/api';
import * as d3 from 'd3';

type SpouseInfoDto = {
  spouse?: FamilyNodeDto | null;
  childIds: number[];
  spouseRefId?: number | null;
};

type FamilyNodeDto = {
  id: number;
  name: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  children: FamilyNodeDto[];
  avatarUrl?: string | null;
  userId?: number | null;
  spouses: SpouseInfoDto[];   // ordered list of spouse-groups (empty = none)
  deceased?: boolean;
  parentRelation?: string | null;
};

/* ---- relation helpers ---- */
const RELATION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BIOLOGICAL_FATHER: { label: 'Bio', color: '#1b5e20', bg: '#e8f5e9', icon: '🧬' },
  BIOLOGICAL_MOTHER: { label: 'Bio', color: '#1b5e20', bg: '#e8f5e9', icon: '🧬' },
  FOSTER_FATHER:     { label: 'Foster', color: '#e65100', bg: '#fff3e0', icon: '🏠' },
  FOSTER_MOTHER:     { label: 'Foster', color: '#e65100', bg: '#fff3e0', icon: '🏠' },
  ADOPTIVE_FATHER:   { label: 'Adopted', color: '#4a148c', bg: '#f3e5f5', icon: '💜' },
  ADOPTIVE_MOTHER:   { label: 'Adopted', color: '#4a148c', bg: '#f3e5f5', icon: '💜' },
  STEP_FATHER:       { label: 'Step', color: '#0d47a1', bg: '#e3f2fd', icon: '👣' },
  STEP_MOTHER:       { label: 'Step', color: '#0d47a1', bg: '#e3f2fd', icon: '👣' },
  GUARDIAN:           { label: 'Ward', color: '#546e7a', bg: '#eceff1', icon: '🛡️' },
};

/* ---- layout constants ---- */
const NODE_W = 220;
const NODE_H = 72;
const NODE_RX = 12;
const COUPLE_GAP = 20;
const H_GAP = 36;
const V_GAP = 90;
const AVATAR_R = 18;
const FONT_SIZE = 11;
const SUB_FONT_SIZE = 9.5;

/* ---- flatten tree helper for search ---- */
type FlatNode = { id: number; name: string; idPath: string; x: number; y: number };

function flattenNodes(
  nodes: { data: FamilyNodeDto; x: number; y: number; idPath: string }[],
): FlatNode[] {
  const flat: FlatNode[] = [];
  for (const n of nodes) {
    const sc = n.data.spouses?.length ?? 0;
    flat.push({ id: n.data.id, name: n.data.name, idPath: n.idPath, x: n.x, y: n.y });
    if (sc > 0) {
      for (let i = 0; i < sc; i++) {
        const sp = n.data.spouses[i].spouse;
        if (!sp) continue;
        const offset = spouseOffset(sc, i);
        flat.push({
          id: sp.id, name: sp.name,
          idPath: n.idPath + `-spouse-${i}`,
          x: n.x + offset,
          y: n.y,
        });
      }
    }
  }
  return flat;
}

/** Compute x-offset for the i-th spouse relative to the d3 node center */
function spouseOffset(spouseCount: number, index: number): number {
  if (spouseCount === 1) {
    // Current: person left, spouse right
    return (NODE_W + COUPLE_GAP);
  }
  if (spouseCount === 2) {
    // Person center, spouse0 left, spouse1 right
    return index === 0 ? -(NODE_W + COUPLE_GAP) : (NODE_W + COUPLE_GAP);
  }
  // 3+: person leftmost, spouses in a row to the right
  return (index + 1) * (NODE_W + COUPLE_GAP);
}

/** Compute x-offset for the primary person when they have spouses */
function personOffset(spouseCount: number): number {
  if (spouseCount === 1) return -(NODE_W + COUPLE_GAP) / 2;
  if (spouseCount === 2) return 0;  // person centered
  return 0;  // 3+: person on the left edge (at d3 x)
}

/** Total "unit width" used in d3 separation for a node with N spouses */
function clusterWidth(spouseCount: number): number {
  if (spouseCount <= 1) return spouseCount === 0 ? 1 : 2;
  return 1 + spouseCount;
}

/* ---- format dates ---- */
function fmtYear(d?: string | null): string {
  if (!d) return '?';
  return d.substring(0, 4);
}

function lifespan(dob?: string | null, dod?: string | null, deceased?: boolean): string {
  const b = fmtYear(dob);
  const d = deceased || dod ? fmtYear(dod) : '';
  if (b === '?' && !d) return '';
  if (d) return `(${b}–${d})`;
  return `(b. ${b})`;
}

export default function FamilyTreePage() {
  const [root, setRoot] = useState<FamilyNodeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [myPersonId, setMyPersonId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* ---------- search state ---------- */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => setFullscreen(f => !f));
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.personId) setMyPersonId(p.personId);
        const role: string = p?.userRole || '';
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<FamilyNodeDto>('/api/family/tree', { method: 'GET' });
        if (alive) setRoot(data);
      } catch (e) { console.error(e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* Keyboard shortcut: Ctrl+F → open search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!root) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <Typography color="text.secondary">No family data.</Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        maxWidth: fullscreen ? '100%' : 1400,
        mx: 'auto',
        p: fullscreen ? 0 : 2,
        ...(fullscreen && {
          position: 'fixed', inset: 0, zIndex: 1300,
          bgcolor: 'background.default', overflow: 'hidden',
        }),
      }}
    >
      <Box
        className={fullscreen ? undefined : 'card'}
        sx={{
          p: fullscreen ? 0 : { xs: 2, sm: 4 },
          height: fullscreen ? '100vh' : 'auto',
          display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: fullscreen ? 0 : 2, p: fullscreen ? 1.5 : 0, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>Family Tree</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Admin: add person */}
            {isAdmin && (
              <Tooltip title="Add Person">
                <IconButton onClick={() => setAddPersonOpen(true)} size="small" sx={{ color: 'var(--color-primary-500)' }}>
                  <PersonAddIcon />
                </IconButton>
              </Tooltip>
            )}
            {/* Search toggle */}
            <Tooltip title="Search (Ctrl+F)">
              <IconButton onClick={() => setSearchOpen(o => !o)} size="small" sx={{ color: 'text.secondary' }}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'text.secondary' }}>
                {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <SvgTree
          root={root}
          myPersonId={myPersonId}
          fullscreen={fullscreen}
          searchTerm={searchTerm}
          matchIdx={matchIdx}
          searchOpen={searchOpen}
          setSearchTerm={setSearchTerm}
          setMatchIdx={setMatchIdx}
          setSearchOpen={setSearchOpen}
        />
      </Box>

      {/* Admin: Add Person Dialog */}
      {isAdmin && (
        <AddPersonDialog
          open={addPersonOpen}
          onClose={() => setAddPersonOpen(false)}
          onCreated={() => {
            setAddPersonOpen(false);
            // Reload tree data
            setLoading(true);
            apiFetch<FamilyNodeDto>('/api/family/tree', { method: 'GET' })
              .then(setRoot)
              .catch(console.error)
              .finally(() => setLoading(false));
          }}
        />
      )}
    </Box>
  );
}

/* ==================== SVG Tree ==================== */

interface SvgTreeProps {
  root: FamilyNodeDto;
  myPersonId: number | null;
  fullscreen: boolean;
  searchTerm: string;
  matchIdx: number;
  searchOpen: boolean;
  setSearchTerm: (v: string) => void;
  setMatchIdx: (v: number | ((p: number) => number)) => void;
  setSearchOpen: (v: boolean) => void;
}

function SvgTree({
  root, myPersonId, fullscreen,
  searchTerm, matchIdx, searchOpen, setSearchTerm, setMatchIdx, setSearchOpen,
}: SvgTreeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 600 });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [initialCenterDone, setInitialCenterDone] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handle = () => {
      if (fullscreen) {
        setViewport({ width: window.innerWidth, height: window.innerHeight - 56 });
      } else {
        setViewport({
          width: Math.min(window.innerWidth - 64, 1400),
          height: Math.max(Math.min(window.innerHeight - 220, 900), 420),
        });
      }
    };
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [fullscreen]);

  /* Build d3 hierarchy */
  const { nodes, linkGroups, coupleLinks, crossLinks, translate } = useMemo(() => {
    // Reorder children of multi-spouse nodes so D3 places them
    // left-to-right matching the spouse layout:
    //   2 spouses: [spouse0(left) kids, solo(center) kids, spouse1(right) kids]
    function reorderChildren(node: FamilyNodeDto): FamilyNodeDto {
      const sc = node.spouses?.length ?? 0;
      let kids = node.children;
      if (sc === 2) {
        const s0 = new Set(node.spouses[0].childIds ?? []);
        const s1 = new Set(node.spouses[1].childIds ?? []);
        const g0 = kids.filter(c => s0.has(c.id));
        const solo = kids.filter(c => !s0.has(c.id) && !s1.has(c.id));
        const g1 = kids.filter(c => s1.has(c.id));
        kids = [...g0, ...solo, ...g1];
      }
      return { ...node, children: kids.map(reorderChildren) };
    }
    const ordered = reorderChildren(root);
    const hroot = d3.hierarchy<FamilyNodeDto>(ordered, d => d?.children || []);

    const treeLayout = d3.tree<FamilyNodeDto>()
      .nodeSize([NODE_W + H_GAP, NODE_H + V_GAP])
      .separation((a, b) => {
        const aw = clusterWidth(a.data.spouses?.length ?? 0);
        const bw = clusterWidth(b.data.spouses?.length ?? 0);
        return (aw + bw) / 2;
      });

    const laid = treeLayout(hroot);

    const n = laid.descendants().map(d => ({
      x: d.x,
      y: d.y,
      data: d.data,
      depth: d.depth,
      idPath: computeIdPath(d),
    }));

    // Position map: person id → absolute {x, y}
    const posById = new Map<number, { x: number; y: number }>();
    for (const nn of n) {
      const sc = nn.data.spouses?.length ?? 0;
      if (sc === 0) {
        posById.set(nn.data.id, { x: nn.x, y: nn.y });
      } else {
        // Person position
        const pOff = personOffset(sc);
        posById.set(nn.data.id, { x: nn.x + pOff, y: nn.y });
        // Each spouse position
        for (let i = 0; i < sc; i++) {
          const sp = nn.data.spouses[i].spouse;
          if (sp) {
            const sOff = spouseOffset(sc, i);
            posById.set(sp.id, { x: nn.x + pOff + sOff, y: nn.y });
          }
        }
      }
    }

    // Build link groups: map parent → child connectors
    // For multi-spouse nodes, split into per-spouse-group sub-combs.
    // Two-pass: first collect children per group with the couple-connector
    // midpoint as anchor, then finalize into link groups.
    type LinkGroup = { source: { x: number; y: number }; targets: { x: number; y: number }[]; stagger?: number };
    const groups = new Map<string, LinkGroup>();
    const multiGroupData = new Map<string, { targets: { x: number; y: number }[]; sourceY: number; anchorX: number; parentKey: string }>();

    for (const lk of laid.links()) {
      const parentData = lk.source.data;
      const childId = lk.target.data.id;
      const sc = parentData.spouses?.length ?? 0;

      if (sc >= 2) {
        const pOff = personOffset(sc);
        let groupSuffix = '-solo';
        let anchorX = lk.source.x + pOff; // default: person center (solo kids)

        for (let i = 0; i < sc; i++) {
          if (parentData.spouses[i].childIds?.includes(childId)) {
            groupSuffix = `-sg${i}`;
            // Anchor at midpoint between person center and spouse center
            const personX = lk.source.x + pOff;
            const spouseX = personX + spouseOffset(sc, i);
            anchorX = (personX + spouseX) / 2;
            break;
          }
        }
        const fullKey = computeIdPath(lk.source) + groupSuffix;
        if (!multiGroupData.has(fullKey)) {
          multiGroupData.set(fullKey, { targets: [], sourceY: lk.source.y, anchorX, parentKey: computeIdPath(lk.source) });
        }
        multiGroupData.get(fullKey)!.targets.push({ x: lk.target.x, y: lk.target.y });
      } else {
        // 0 or 1 spouse: use d3's source x directly
        const sKey = computeIdPath(lk.source);
        if (!groups.has(sKey)) {
          groups.set(sKey, { source: { x: lk.source.x, y: lk.source.y }, targets: [] });
        }
        groups.get(sKey)!.targets.push({ x: lk.target.x, y: lk.target.y });
      }
    }

    // Pass 2: assign stagger levels (left-to-right) so horizontal bars don't overlap
    const byParent = new Map<string, { key: string; anchorX: number }[]>();
    for (const [key, data] of multiGroupData) {
      if (!byParent.has(data.parentKey)) byParent.set(data.parentKey, []);
      byParent.get(data.parentKey)!.push({ key, anchorX: data.anchorX });
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => a.anchorX - b.anchorX); // left to right
      const count = siblings.length;
      siblings.forEach((s, idx) => {
        const data = multiGroupData.get(s.key)!;
        // Leftmost gets highest stagger (most offset up), rightmost gets 0 (default)
        const stagger = count - 1 - idx;
        groups.set(s.key, { source: { x: data.anchorX, y: data.sourceY }, targets: data.targets, stagger });
      });
    }

    // Couple connector lines
    const cl: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (const nn of n) {
      const sc = nn.data.spouses?.length ?? 0;
      if (sc === 0) continue;
      const pOff = personOffset(sc);
      const personX = nn.x + pOff;
      for (let i = 0; i < sc; i++) {
        const sp = nn.data.spouses[i].spouse;
        if (!sp) continue;
        const sOff = spouseOffset(sc, i);
        const spouseX = personX + sOff;
        // connector from person edge to spouse edge
        const x1 = Math.min(personX, spouseX) + NODE_W / 2;
        const x2 = Math.max(personX, spouseX) - NODE_W / 2;
        cl.push({ x1, y1: nn.y, x2, y2: nn.y, key: `couple-${nn.data.id}-${sp.id}` });
      }
    }

    // Cross-links: nodes with spouseRefId
    const crossLks: { fromX: number; fromY: number; toX: number; toY: number; key: string }[] = [];
    for (const nn of n) {
      const sc = nn.data.spouses?.length ?? 0;
      for (let i = 0; i < sc; i++) {
        const refId = nn.data.spouses[i].spouseRefId;
        if (!refId) continue;
        const target = posById.get(refId);
        if (!target) continue;
        const from = posById.get(nn.data.id) ?? { x: nn.x, y: nn.y };
        crossLks.push({
          fromX: from.x, fromY: from.y,
          toX: target.x, toY: target.y,
          key: `xlink-${nn.data.id}-${refId}`,
        });
      }
    }

    return {
      nodes: n,
      linkGroups: Array.from(groups.entries()).map(([key, g]) => ({ key, ...g })),
      coupleLinks: cl,
      crossLinks: crossLks,
      translate: { x: 60, y: 40 },
    };
  }, [root]);

  /* Search matches */
  const flatNodes = useMemo(() => flattenNodes(nodes), [nodes]);
  const matches = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return flatNodes.filter(n => n.name.toLowerCase().includes(q));
  }, [flatNodes, searchTerm]);

  /* Clamp matchIdx */
  useEffect(() => {
    if (matches.length === 0) { setMatchIdx(0); return; }
    setMatchIdx(i => Math.min(i, matches.length - 1));
  }, [matches.length, setMatchIdx]);

  /* Auto-focus search input */
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  /* Zoom / pan */
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .on('zoom', (ev) => g.attr('transform', ev.transform.toString()));

    zoomRef.current = zoom;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg.call(zoom as any);
    const initial = d3.zoomIdentity.translate(translate.x, translate.y).scale(0.9);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg.call(zoom.transform as any, initial);

    return () => { svg.on('.zoom', null); };
  }, [translate]);

  /* Find Marcus Scott's node position and IDs for centering & highlight */
  const marcusInfo = useMemo(() => {
    for (const n of nodes) {
      if (n.data.name?.toLowerCase().includes('marcus') && n.data.name?.toLowerCase().includes('scott')) {
        const ids = [n.data.id];
        for (const si of (n.data.spouses ?? [])) {
          if (si.spouse) ids.push(si.spouse.id);
        }
        return { x: n.x, y: n.y, ids };
      }
      for (const si of (n.data.spouses ?? [])) {
        if (si.spouse?.name?.toLowerCase().includes('marcus') && si.spouse?.name?.toLowerCase().includes('scott')) {
          const ids = [n.data.id, si.spouse.id];
          return { x: n.x, y: n.y, ids };
        }
      }
    }
    return null;
  }, [nodes]);
  const marcusNode = marcusInfo ? { x: marcusInfo.x, y: marcusInfo.y } : null;

  /* Center on Marcus & Caroline on initial load */
  const centerOnMarcus = useCallback((animate = true) => {
    if (!marcusNode || !svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const scale = 0.9;
    const tx = viewport.width / 2 - marcusNode.x * scale;
    const ty = viewport.height / 2 - marcusNode.y * scale;
    if (animate) {
      svg.transition().duration(500)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(zoomRef.current.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svg.call(zoomRef.current.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
  }, [marcusNode, viewport]);

  useEffect(() => {
    if (!initialCenterDone && marcusNode && svgRef.current && zoomRef.current) {
      // Small delay to ensure layout has settled
      const t = setTimeout(() => { centerOnMarcus(false); setInitialCenterDone(true); }, 100);
      return () => clearTimeout(t);
    }
  }, [initialCenterDone, marcusNode, centerOnMarcus]);

  /* Center on current match */
  const centerOnMatch = useCallback((idx: number) => {
    if (!matches[idx] || !svgRef.current || !zoomRef.current) return;
    const m = matches[idx];
    const svg = d3.select(svgRef.current);
    const scale = 1.0;
    const tx = viewport.width / 2 - m.x * scale;
    const ty = viewport.height / 2 - m.y * scale;
    svg.transition().duration(400)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(zoomRef.current.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [matches, viewport]);

  useEffect(() => { if (matches.length > 0) centerOnMatch(matchIdx); }, [matchIdx, matches.length, centerOnMatch]);

  const matchIdSet = useMemo(() => new Set(matches.map(m => m.id)), [matches]);
  const activeMatchId = matches[matchIdx]?.id ?? null;

  const goPrev = () => setMatchIdx(i => (i - 1 + matches.length) % matches.length);
  const goNext = () => setMatchIdx(i => (i + 1) % matches.length);

  return (
    <Box sx={{ position: 'relative' }}>
      {/* ---- Search bar overlay ---- */}
      {searchOpen && (
        <Box sx={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 0.5,
          bgcolor: 'background.paper', borderRadius: 2, px: 1.5, py: 0.5,
          boxShadow: 3, border: '1px solid', borderColor: 'divider',
        }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            placeholder="Search name…"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setMatchIdx(0); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { if (e.shiftKey) goPrev(); else goNext(); }
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            sx={{ width: 200, '& .MuiOutlinedInput-root': { fontSize: 13 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} /></InputAdornment>,
            }}
          />
          {searchTerm && (
            <Chip
              size="small"
              label={matches.length === 0 ? '0' : `${matchIdx + 1}/${matches.length}`}
              sx={{ fontWeight: 600, fontSize: 11, height: 22, minWidth: 40, justifyContent: 'center' }}
              color={matches.length > 0 ? 'primary' : 'default'}
            />
          )}
          <IconButton size="small" onClick={goPrev} disabled={matches.length < 2}>
            <KeyboardArrowUpIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={goNext} disabled={matches.length < 2}>
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => { setSearchOpen(false); setSearchTerm(''); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Re-center button */}
      {marcusNode && (
        <Tooltip title="Center on Marcus & Caroline Scott">
          <IconButton
            onClick={() => {
              centerOnMarcus(true);
              if (marcusInfo) {
                setHighlightIds(new Set(marcusInfo.ids));
                setTimeout(() => setHighlightIds(new Set()), 1800);
              }
            }}
            size="small"
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 2,
              '&:hover': { bgcolor: 'var(--color-primary-50)' },
            }}
          >
            <CenterFocusStrongIcon fontSize="small" sx={{ color: 'var(--color-primary-600)' }} />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <svg ref={svgRef} width="100%" height={viewport.height} viewBox={`0 0 ${viewport.width} ${viewport.height}`}>
          <defs>
            <marker id="crosslink-arrow" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth={6} markerHeight={6} orient="auto-start-reverse" fill="#90a4ae">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <style>{`
              @keyframes node-highlight-pulse {
                0%   { stroke-opacity: 1; fill-opacity: 1; }
                50%  { stroke-opacity: 0.4; fill-opacity: 0.6; }
                100% { stroke-opacity: 1; fill-opacity: 1; }
              }
            `}</style>
          </defs>
          <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="#fafafa" />
          <g ref={gRef}>
            {/* Comb-style connectors */}
            <g fill="none" stroke="#c8ccd2" strokeWidth={1.2}>
              {linkGroups.map(lg => {
                const sy = lg.source.y + NODE_H / 2;
                const ty = lg.targets[0].y - NODE_H / 2;
                const baseMidY = (sy + ty) / 2;
                const STAGGER_STEP = 14;
                const midY = baseMidY - (lg.stagger ?? 0) * STAGGER_STEP;
                const ax = lg.source.x;
                const allX = [ax, ...lg.targets.map(t => t.x)];
                const barLeft = Math.min(...allX);
                const barRight = Math.max(...allX);
                return (
                  <g key={lg.key}>
                    <line x1={ax} y1={sy} x2={ax} y2={midY} />
                    {barLeft < barRight && <line x1={barLeft} y1={midY} x2={barRight} y2={midY} />}
                    {lg.targets.map((t, i) => <line key={i} x1={t.x} y1={midY} x2={t.x} y2={ty} />)}
                  </g>
                );
              })}
            </g>

            {/* Couple connectors */}
            <g stroke="#c8ccd2" strokeWidth={1.2}>
              {coupleLinks.map(cl => (
                <line key={cl.key} x1={cl.x1} y1={cl.y1} x2={cl.x2} y2={cl.y2} />
              ))}
            </g>

            {/* Cross-links: dashed curved connector to a spouse placed elsewhere */}
            <g fill="none" stroke="#90a4ae" strokeWidth={1.4} strokeDasharray="6 4">
              {crossLinks.map(xl => {
                // Curved path: go up from source, arc over, come down to target
                const dx = xl.toX - xl.fromX;
                const dy = xl.toY - xl.fromY;
                const cpOffset = Math.max(60, Math.abs(dy) * 0.4 + 30);
                // Use a quadratic Bezier that arcs above/below depending on direction
                const cpY = Math.min(xl.fromY, xl.toY) - cpOffset;
                const path = `M ${xl.fromX} ${xl.fromY - NODE_H / 2}`
                  + ` Q ${xl.fromX + dx * 0.5} ${cpY}, ${xl.toX} ${xl.toY - NODE_H / 2}`;
                return <path key={xl.key} d={path} markerEnd="url(#crosslink-arrow)" />;
              })}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map(n => {
                const sc = n.data.spouses?.length ?? 0;
                const pOff = personOffset(sc);
                return (
                  <g key={n.idPath} transform={`translate(${n.x},${n.y})`}>
                    {/* Primary person */}
                    <g transform={`translate(${pOff},0)`}>
                      <NodeBox node={n.data} myPersonId={myPersonId} isMatch={matchIdSet.has(n.data.id)} isActive={activeMatchId === n.data.id} isHighlighted={highlightIds.has(n.data.id)} />
                    </g>
                    {/* Spouse nodes */}
                    {sc > 0 && n.data.spouses.map((si, i) => {
                      if (!si.spouse) return null;
                      const sOff = spouseOffset(sc, i);
                      return (
                        <g key={`sp-${si.spouse.id}`} transform={`translate(${pOff + sOff},0)`}>
                          <NodeBox node={si.spouse} myPersonId={myPersonId} isMatch={matchIdSet.has(si.spouse.id)} isActive={activeMatchId === si.spouse.id} isHighlighted={highlightIds.has(si.spouse.id)} />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </Box>
    </Box>
  );
}

/* ==================== Node Card ==================== */

function NodeBox({ node, myPersonId, isMatch, isActive, isHighlighted }: {
  node: FamilyNodeDto; myPersonId: number | null; isMatch: boolean; isActive: boolean; isHighlighted?: boolean;
}) {
  const name = node.name || '(Unnamed)';
  const isDeceased = !!node.deceased;
  const displayName = isDeceased ? `${name} †` : name;
  const dates = lifespan(node.dateOfBirth, node.dateOfDeath, node.deceased);
  const initials =
    name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';

  const x = -NODE_W / 2;
  const top = -NODE_H / 2;

  const avatarCx = x + 16 + AVATAR_R;
  const avatarCy = 0;

  const textX = avatarCx + AVATAR_R + 10;

  const rectFill = isHighlighted ? '#e3f2fd' : isActive ? '#fff9c4' : isMatch ? '#fffde7' : isDeceased ? '#f5f5f5' : '#fff';
  const rectStroke = isHighlighted ? '#1976d2' : isActive ? '#f9a825' : isMatch ? '#fdd835' : isDeceased ? '#bdbdbd' : '#ced3da';
  const strokeW = isHighlighted ? 3 : isActive ? 2.5 : isMatch ? 2 : 1;

  /* Relation badge */
  const rel = node.parentRelation;
  const meta = rel ? RELATION_META[rel] : null;

  return (
    <g style={isDeceased && !isMatch ? { opacity: 0.75 } : undefined}>
      {/* Card */}
      <rect x={x} y={top} width={NODE_W} height={NODE_H} rx={NODE_RX} ry={NODE_RX}
        fill={rectFill} stroke={rectStroke} strokeWidth={strokeW}
        style={isHighlighted ? { animation: 'node-highlight-pulse 0.6s ease-in-out 3' } : undefined} />

      {/* Avatar */}
      <clipPath id={`clip-${node.id}`}>
        <circle cx={avatarCx} cy={avatarCy} r={AVATAR_R} />
      </clipPath>
      <circle cx={avatarCx} cy={avatarCy} r={AVATAR_R} fill="#e5e7eb" stroke="#d1d5db" />

      {node.avatarUrl ? (
        <image
          href={node.avatarUrl}
          x={avatarCx - AVATAR_R} y={avatarCy - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#clip-${node.id})`}
        />
      ) : (
        <text x={avatarCx} y={avatarCy + 1} fontSize={12} textAnchor="middle" alignmentBaseline="middle"
          fill="#111827" style={{ fontWeight: 600, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial' }}>
          {initials}
        </text>
      )}

      {/* Name + dates */}
      <foreignObject x={textX - 2} y={top + (meta ? 4 : 10)} width={NODE_W - (textX - x) - 10} height={meta ? 22 : NODE_H - 20}>
        <MUILink
          component={NextLink}
          href={myPersonId && node.id === myPersonId ? '/profile' : `/profile/${node.id}`}
          underline="hover"
          sx={{
            display: 'block', lineHeight: 1.25, fontSize: FONT_SIZE,
            color: isDeceased ? 'text.secondary' : 'text.primary',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {displayName}
        </MUILink>
      </foreignObject>

      {/* Dates line */}
      {dates && (
        <text
          x={textX - 1}
          y={top + (meta ? 32 : 42)}
          fontSize={SUB_FONT_SIZE}
          fill="#78909c"
          style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial' }}
        >
          {dates}
        </text>
      )}

      {/* Relation badge */}
      {meta && (
        <g transform={`translate(${textX - 1}, ${top + 40})`}>
          <rect width={meta.label.length * 6.5 + 24} height={16} rx={8} fill={meta.bg} stroke={meta.color} strokeWidth={0.5} />
          <text x={4} y={11.5} fontSize={9} fill={meta.color}
            style={{ fontFamily: 'system-ui' }}>
            {meta.icon}
          </text>
          <text x={18} y={11.5} fontSize={9} fill={meta.color} fontWeight={700}
            style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial' }}>
            {meta.label}
          </text>
        </g>
      )}
    </g>
  );
}

/* ==================== Add Person Dialog ==================== */

type ParentOption = { personId: number; displayName: string };

const RELATION_TYPES = [
  { value: 'BIOLOGICAL', label: 'Biological' },
  { value: 'ADOPTIVE', label: 'Adoptive' },
  { value: 'STEP', label: 'Step' },
  { value: 'FOSTER', label: 'Foster' },
  { value: 'GUARDIAN', label: 'Guardian' },
];

function AddPersonDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [dob, setDob] = useState('');
  const [dod, setDod] = useState('');
  const [bio, setBio] = useState('');

  // Parent pickers
  const [fatherQuery, setFatherQuery] = useState('');
  const [motherQuery, setMotherQuery] = useState('');
  const [fatherOptions, setFatherOptions] = useState<ParentOption[]>([]);
  const [motherOptions, setMotherOptions] = useState<ParentOption[]>([]);
  const [father, setFather] = useState<ParentOption | null>(null);
  const [mother, setMother] = useState<ParentOption | null>(null);
  const [fatherRelation, setFatherRelation] = useState('BIOLOGICAL');
  const [motherRelation, setMotherRelation] = useState('BIOLOGICAL');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Search parents
  useEffect(() => {
    if (fatherQuery.length < 2) { setFatherOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const results = await apiFetch<ParentOption[]>(`/api/people/search?q=${encodeURIComponent(fatherQuery)}&limit=10`);
        setFatherOptions(results);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [fatherQuery]);

  useEffect(() => {
    if (motherQuery.length < 2) { setMotherOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const results = await apiFetch<ParentOption[]>(`/api/people/search?q=${encodeURIComponent(motherQuery)}&limit=10`);
        setMotherOptions(results);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [motherQuery]);

  const reset = () => {
    setFirstName(''); setLastName(''); setMiddleName(''); setSuffix('');
    setDob(''); setDod(''); setBio('');
    setFather(null); setMother(null);
    setFatherRelation('BIOLOGICAL'); setMotherRelation('BIOLOGICAL');
    setFatherQuery(''); setMotherQuery('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/people', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim() || null,
          suffix: suffix.trim() || null,
          dateOfBirth: dob || null,
          dateOfDeath: dod || null,
          bio: bio.trim() || null,
          fatherId: father?.personId ?? null,
          motherId: mother?.personId ?? null,
          fatherRelation: father ? `${fatherRelation}_FATHER` : null,
          motherRelation: mother ? `${motherRelation}_MOTHER` : null,
        },
      });
      reset();
      onCreated();
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to create person.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Person</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Typography color="error" variant="body2">{error}</Typography>}

          <Stack direction="row" spacing={2}>
            <TextField label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required fullWidth size="small" />
            <TextField label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required fullWidth size="small" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} fullWidth size="small" />
            <TextField label="Suffix" value={suffix} onChange={e => setSuffix(e.target.value)} placeholder="Jr., Sr., III" fullWidth size="small" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Date of Birth" type="date" value={dob} onChange={e => setDob(e.target.value)} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Date of Death" type="date" value={dod} onChange={e => setDod(e.target.value)} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>

          {/* Father picker */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Autocomplete
              sx={{ flex: 1 }}
              options={fatherOptions}
              getOptionLabel={o => o.displayName}
              value={father}
              onChange={(_, v) => setFather(v)}
              onInputChange={(_, v) => setFatherQuery(v)}
              isOptionEqualToValue={(a, b) => a.personId === b.personId}
              noOptionsText={fatherQuery.length < 2 ? 'Type to search…' : 'No results'}
              renderInput={params => <TextField {...params} label="Father" size="small" />}
            />
            <TextField
              select label="Relation" size="small" sx={{ width: 140 }}
              value={fatherRelation} onChange={e => setFatherRelation(e.target.value)}
            >
              {RELATION_TYPES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>

          {/* Mother picker */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Autocomplete
              sx={{ flex: 1 }}
              options={motherOptions}
              getOptionLabel={o => o.displayName}
              value={mother}
              onChange={(_, v) => setMother(v)}
              onInputChange={(_, v) => setMotherQuery(v)}
              isOptionEqualToValue={(a, b) => a.personId === b.personId}
              noOptionsText={motherQuery.length < 2 ? 'Type to search…' : 'No results'}
              renderInput={params => <TextField {...params} label="Mother" size="small" />}
            />
            <TextField
              select label="Relation" size="small" sx={{ width: 140 }}
              value={motherRelation} onChange={e => setMotherRelation(e.target.value)}
            >
              {RELATION_TYPES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>

          <TextField label="Bio" value={bio} onChange={e => setBio(e.target.value)} multiline rows={3} fullWidth size="small" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { reset(); onClose(); }} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}
          sx={{ bgcolor: 'var(--color-primary-500)', '&:hover': { bgcolor: 'var(--color-primary-600)' } }}
        >
          {saving ? 'Adding…' : 'Add Person'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ==================== Helpers ==================== */

function computeIdPath(d: d3.HierarchyNode<FamilyNodeDto>): string {
  const parts: string[] = [];
  let cur: d3.HierarchyNode<FamilyNodeDto> | null = d;
  while (cur) {
    if (cur.parent) {
      const idx = cur.parent.children ? cur.parent.children.indexOf(cur) : 0;
      parts.push(`${cur.data.id}:${idx}`);
    } else {
      parts.push('root');
    }
    cur = cur.parent;
  }
  return parts.reverse().join('->');
}
