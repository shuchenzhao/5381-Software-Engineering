/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { TimeBucket, TimeUnit, LinkDatum } from './types';

/**
 * Parse a timestamp from various possible formats.
 * Returns milliseconds since epoch, or NaN if parsing fails.
 */
export function parseTimestamp(value: any): number {
  if (value === null || value === undefined) return NaN;
  
  // Try parsing as ISO string or other date string
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) return parsed;
  
  // Try numeric values (assume ms if > 1e12, seconds otherwise)
  const num = Number(value);
  if (!Number.isNaN(num)) {
    return num > 1e12 ? num : num * 1000;
  }
  
  return NaN;
}

/**
 * Extract all timestamps from link sample events.
 */
export function extractTimestampsFromLinks(links: LinkDatum[]): number[] {
  const timestamps: number[] = [];
  
  links.forEach((link) => {
    const sampleEvents = link.sample_events;
    if (!Array.isArray(sampleEvents)) return;
    
    sampleEvents.forEach((event) => {
      // Try common timestamp field names
      const tsValue = event.timestamp || event.time || event.t || event.ts || event.timestamp_ms;
      const parsed = parseTimestamp(tsValue);
      if (!Number.isNaN(parsed)) {
        timestamps.push(parsed);
      }
    });
  });
  
  return timestamps;
}

/**
 * Build time buckets based on the selected time unit.
 * Only creates buckets that contain at least one timestamp.
 */
export function buildTimeBuckets(timestamps: number[], unit: TimeUnit): TimeBucket[] {
  if (!timestamps.length) return [];
  
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const buckets: TimeBucket[] = [];
  
  if (unit === 'year') {
    const startDate = new Date(min);
    const endDate = new Date(max);
    
    for (let y = startDate.getUTCFullYear(); y <= endDate.getUTCFullYear(); y += 1) {
      const start = Date.UTC(y, 0, 1);
      const end = Date.UTC(y + 1, 0, 1) - 1;
      
      const hasEvents = timestamps.some((ts) => ts >= start && ts <= end);
      if (hasEvents) {
        buckets.push({ startMs: start, label: String(y) });
      }
    }
  } else if (unit === 'month') {
    const startDate = new Date(min);
    const endDate = new Date(max);
    let y = startDate.getUTCFullYear();
    let m = startDate.getUTCMonth();
    
    while (y < endDate.getUTCFullYear() || (y === endDate.getUTCFullYear() && m <= endDate.getUTCMonth())) {
      const start = Date.UTC(y, m, 1);
      const end = Date.UTC(y, m + 1, 1) - 1;
      const label = `${y}-${String(m + 1).padStart(2, '0')}`;
      
      const hasEvents = timestamps.some((ts) => ts >= start && ts <= end);
      if (hasEvents) {
        buckets.push({ startMs: start, label });
      }
      
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  } else if (unit === 'week') {
    // Week buckets with Monday start, restarting at W1 each year
    const date = new Date(min);
    date.setUTCHours(0, 0, 0, 0);
    
    // Shift back to Monday of that week
    const day = date.getUTCDay();
    const diff = (day + 6) % 7; // 0 => Monday
    date.setUTCDate(date.getUTCDate() - diff);
    
    while (date.getTime() <= max) {
      const weekStart = date.getTime();
      const weekEnd = weekStart + 7 * 24 * 3600 * 1000 - 1;
      const year = new Date(weekStart).getUTCFullYear();
      
      // Compute week number relative to start of year
      const yearStart = Date.UTC(year, 0, 1);
      const daysSinceYearStart = Math.floor((weekStart - yearStart) / 86400000);
      const weekNum = Math.floor(daysSinceYearStart / 7) + 1;
      const label = `${year}-W${weekNum}`;
      
      const hasEvents = timestamps.some((ts) => ts >= weekStart && ts <= weekEnd);
      if (hasEvents) {
        buckets.push({ startMs: weekStart, label });
      }
      
      date.setUTCDate(date.getUTCDate() + 7);
    }
  }
  
  return buckets;
}

/**
 * Compute window end time for a given bucket index.
 */
export function computeWindowEnd(
  buckets: TimeBucket[],
  index: number,
  unit: TimeUnit,
): number {
  if (!buckets.length) return 0;
  
  const start = buckets[index].startMs;
  
  // If there's a next bucket, use its start - 1
  if (index + 1 < buckets.length) {
    return buckets[index + 1].startMs - 1;
  }
  
  // For the last bucket, extend based on unit
  if (unit === 'year') {
    const year = new Date(start).getUTCFullYear();
    return Date.UTC(year + 1, 0, 1) - 1;
  } else if (unit === 'month') {
    const d = new Date(start);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return Date.UTC(year, month + 1, 1) - 1;
  } else if (unit === 'week') {
    return start + 7 * 24 * 3600 * 1000 - 1;
  }
  
  return start;
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(timestamp: any): string {
  if (timestamp === undefined || timestamp === null) return '';
  
  // Try to parse numeric timestamp
  if (typeof timestamp === 'number') {
    const ms = timestamp > 1e12 ? timestamp : timestamp > 1e9 ? timestamp : timestamp * 1000;
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return String(timestamp);
    }
  }
  
  // Try ISO string
  const str = String(timestamp);
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleString();
  }
  
  return str;
}
