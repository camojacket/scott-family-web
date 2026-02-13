'use client';

import { useEffect, useMemo, useRef, useState, useCallback, MouseEvent } from 'react';
import {
  Box, CircularProgress, Typography, Link as MUILink, IconButton, Tooltip,
  TextField, InputAdornment, Chip,
} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NextLink from 'next/link';
import { API_BASE, apiFetch } from '../lib/api';
import * as d3 from 'd3';

type FamilyNodeDto = {
  id: number;
  name: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  children: FamilyNodeDto[];
  avatarUrl?: string | null;
  userId?: number | null;
  spouse?: FamilyNodeDto | null;
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
    flat.push({ id: n.data.id, name: n.data.name, idPath: n.idPath, x: n.x, y: n.y });
    if (n.data.spouse) {
      flat.push({
        id: n.data.spouse.id,
        name: n.data.spouse.name,
        idPath: n.idPath + '-spouse',
        x: n.x + (NODE_W + COUPLE_GAP) / 2,
        y: n.y,
      });
    }
  }
  return flat;
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
  const { nodes, linkGroups, coupleLinks, translate } = useMemo(() => {
    const hroot = d3.hierarchy<FamilyNodeDto>(root, d => d?.children || []);

    const treeLayout = d3.tree<FamilyNodeDto>()
      .nodeSize([NODE_W + H_GAP, NODE_H + V_GAP])
      .separation((a, b) => {
        const aw = a.data.spouse ? 2 : 1;
        const bw = b.data.spouse ? 2 : 1;
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

    const groups = new Map<string, { source: { x: number; y: number }; targets: { x: number; y: number }[] }>();
    for (const lk of laid.links()) {
      const sKey = computeIdPath(lk.source);
      if (!groups.has(sKey)) groups.set(sKey, { source: { x: lk.source.x, y: lk.source.y }, targets: [] });
      groups.get(sKey)!.targets.push({ x: lk.target.x, y: lk.target.y });
    }

    const cl = n.filter(nn => nn.data.spouse).map(nn => ({
      x: nn.x, y: nn.y, key: `couple-${nn.data.id}`,
    }));

    return {
      nodes: n,
      linkGroups: Array.from(groups.entries()).map(([key, g]) => ({ key, ...g })),
      coupleLinks: cl,
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
    svg.call(zoom as any);
    const initial = d3.zoomIdentity.translate(translate.x, translate.y).scale(0.9);
    svg.call(zoom.transform as any, initial);

    return () => { svg.on('.zoom', null); };
  }, [translate]);

  /* Center on current match */
  const centerOnMatch = useCallback((idx: number) => {
    if (!matches[idx] || !svgRef.current || !zoomRef.current) return;
    const m = matches[idx];
    const svg = d3.select(svgRef.current);
    const scale = 1.0;
    const tx = viewport.width / 2 - m.x * scale;
    const ty = viewport.height / 2 - m.y * scale;
    svg.transition().duration(400)
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
              if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext(); }
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

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <svg ref={svgRef} width="100%" height={viewport.height} viewBox={`0 0 ${viewport.width} ${viewport.height}`}>
          <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="#fafafa" />
          <g ref={gRef}>
            {/* Comb-style connectors */}
            <g fill="none" stroke="#c8ccd2" strokeWidth={1.2}>
              {linkGroups.map(lg => {
                const sy = lg.source.y + NODE_H / 2;
                const ty = lg.targets[0].y - NODE_H / 2;
                const midY = (sy + ty) / 2;
                const minTx = Math.min(...lg.targets.map(t => t.x));
                const maxTx = Math.max(...lg.targets.map(t => t.x));
                return (
                  <g key={lg.key}>
                    <line x1={lg.source.x} y1={sy} x2={lg.source.x} y2={midY} />
                    {lg.targets.length > 1 && <line x1={minTx} y1={midY} x2={maxTx} y2={midY} />}
                    {lg.targets.map((t, i) => <line key={i} x1={t.x} y1={midY} x2={t.x} y2={ty} />)}
                  </g>
                );
              })}
            </g>

            {/* Couple connectors */}
            <g stroke="#c8ccd2" strokeWidth={1.2}>
              {coupleLinks.map(cl => (
                <line key={cl.key} x1={cl.x - COUPLE_GAP / 2} y1={cl.y} x2={cl.x + COUPLE_GAP / 2} y2={cl.y} />
              ))}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map(n => (
                <g key={n.idPath} transform={`translate(${n.x},${n.y})`}>
                  {n.data.spouse ? (
                    <>
                      <g transform={`translate(${-(NODE_W + COUPLE_GAP) / 2},0)`}>
                        <NodeBox node={n.data} myPersonId={myPersonId} isMatch={matchIdSet.has(n.data.id)} isActive={activeMatchId === n.data.id} />
                      </g>
                      <g transform={`translate(${(NODE_W + COUPLE_GAP) / 2},0)`}>
                        <NodeBox node={n.data.spouse} myPersonId={myPersonId} isMatch={matchIdSet.has(n.data.spouse.id)} isActive={activeMatchId === n.data.spouse.id} />
                      </g>
                    </>
                  ) : (
                    <NodeBox node={n.data} myPersonId={myPersonId} isMatch={matchIdSet.has(n.data.id)} isActive={activeMatchId === n.data.id} />
                  )}
                </g>
              ))}
            </g>
          </g>
        </svg>
      </Box>
    </Box>
  );
}

/* ==================== Node Card ==================== */

function NodeBox({ node, myPersonId, isMatch, isActive }: {
  node: FamilyNodeDto; myPersonId: number | null; isMatch: boolean; isActive: boolean;
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

  const rectFill = isActive ? '#fff9c4' : isMatch ? '#fffde7' : isDeceased ? '#f5f5f5' : '#fff';
  const rectStroke = isActive ? '#f9a825' : isMatch ? '#fdd835' : isDeceased ? '#bdbdbd' : '#ced3da';
  const strokeW = isActive ? 2.5 : isMatch ? 2 : 1;

  /* Relation badge */
  const rel = node.parentRelation;
  const meta = rel ? RELATION_META[rel] : null;

  return (
    <g style={isDeceased && !isMatch ? { opacity: 0.75 } : undefined}>
      {/* Card */}
      <rect x={x} y={top} width={NODE_W} height={NODE_H} rx={NODE_RX} ry={NODE_RX}
        fill={rectFill} stroke={rectStroke} strokeWidth={strokeW} />

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
