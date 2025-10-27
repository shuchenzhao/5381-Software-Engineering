import { NodeDatum, ViewTransform } from './types';

export const getLinkId = (ln: any) => {
  const a = typeof ln.source === 'string' ? ln.source : ln.source?.id;
  const b = typeof ln.target === 'string' ? ln.target : ln.target?.id;
  if (!a || !b) return null;
  return a < b ? `${a}||${b}` : `${b}||${a}`;
};

export const computeViewFit = (
  nodes: NodeDatum[] | undefined | null,
  width: number,
  height: number,
  margin = 40,
  minK = 0.2,
  maxK = 4,
): ViewTransform | null => {
  if (!nodes || !nodes.length) return null;
  const xs = nodes.map((d) => d.x || 0);
  const ys = nodes.map((d) => d.y || 0);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const availableW = Math.max(10, width - margin * 2);
  const availableH = Math.max(10, height - margin * 2);
  let k = Math.min(availableW / contentW, availableH / contentH);
  k = Math.max(minK, Math.min(maxK, k));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const tx = width / 2 - k * centerX;
  const ty = height / 2 - k * centerY;
  return { x: tx, y: ty, k };
};

export const clampLinkDistance = (distanceScale: number, weight: number, minWeight = 0.1, minDist = 20, maxDist = 400) => {
  const eff = Math.max(minWeight, weight || 0);
  const raw = distanceScale / eff;
  return Math.min(maxDist, Math.max(minDist, raw));
};
