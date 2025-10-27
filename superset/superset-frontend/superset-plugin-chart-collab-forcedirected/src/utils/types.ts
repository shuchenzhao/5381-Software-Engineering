export type NodeDatum = { id: string; x?: number; y?: number; vx?: number; vy?: number; size?: number; fx?: number | undefined; fy?: number | undefined; meta?: any };
export type SampleEvent = {
  id?: string;
  type?: string;
  timestamp?: string | number;
  time?: string | number;
  ts?: string | number;
  timestamp_ms?: string | number;
  actor?: string;
  target?: string;
  lines_added?: number;
  lines_deleted?: number;
  [k: string]: any;
};

export type LinkDatum = {
  source: string | NodeDatum;
  target: string | NodeDatum;
  weight: number;
  types?: Record<string, number>;
  sample_events?: SampleEvent[];
  first?: number;
  last?: number;
};

export type Bucket = { startMs: number; label: string };
export type WindowRange = { startMs: number; endMs: number } | null;
export type ViewTransform = { x: number; y: number; k: number };
