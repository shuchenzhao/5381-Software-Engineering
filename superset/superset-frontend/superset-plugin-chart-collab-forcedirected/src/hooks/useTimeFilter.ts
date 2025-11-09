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
import { useEffect, useRef, useState } from 'react';
import { LinkDatum, TimeUnit, TimeBucket, WindowRange } from '../utils/types';
import {
  extractTimestampsFromLinks,
  buildTimeBuckets,
  computeWindowEnd,
} from '../utils/timeUtils';

/**
 * Custom hook for managing time-based filtering of collaboration data.
 * 
 * Handles:
 * - Time unit selection (year/month/week)
 * - Time bucket computation from link timestamps
 * - Slider-based bucket selection with debouncing
 * - Window range calculation for data filtering
 * 
 * @param links - Array of link data containing sample events with timestamps
 * @param initialUnit - Initial time unit (default: 'month')
 * @returns Time filter state and controls
 */
export function useTimeFilter(
  links: LinkDatum[],
  initialUnit: TimeUnit = 'month'
) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>(initialUnit);
  const [timeBuckets, setTimeBuckets] = useState<TimeBucket[]>([]);
  const [timeIndex, setTimeIndex] = useState<number>(0);
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const [windowRange, setWindowRange] = useState<WindowRange | null>(null);
  
  const sliderDebounceRef = useRef<number | null>(null);

  // Compute time buckets from links' sample_events when links or unit change
  useEffect(() => {
    try {
      const allTimestamps = extractTimestampsFromLinks(links);
      
      if (!allTimestamps.length) {
        setTimeBuckets([]);
        setTimeIndex(0);
        setSliderIndex(0);
        setWindowRange(null);
        return;
      }

      const buckets = buildTimeBuckets(allTimestamps, timeUnit);
      
      // CRITICAL: Set buckets and indices atomically
      // Reset to first bucket when time unit changes
      setTimeBuckets(buckets);
      setTimeIndex(0);
      setSliderIndex(0);
      
      // Immediately compute the window range for the first bucket
      // This prevents a race condition where the window range useEffect
      // might run with old buckets and new timeUnit
      if (buckets.length > 0) {
        const start = buckets[0].startMs;
        const end = computeWindowEnd(buckets, 0, timeUnit);
        setWindowRange({ startMs: start, endMs: end });
      } else {
        setWindowRange(null);
      }
    } catch (err) {
      setTimeBuckets([]);
      setTimeIndex(0);
      setSliderIndex(0);
      setWindowRange(null);
    }
  }, [links, timeUnit]);

  // Keep sliderIndex in sync if timeIndex is updated programmatically
  useEffect(() => {
    setSliderIndex(timeIndex);
  }, [timeIndex]);

  // Debounce sliderIndex -> timeIndex so we don't recreate simulation on every small move
  useEffect(() => {
    if (sliderDebounceRef.current) {
      window.clearTimeout(sliderDebounceRef.current);
    }
    
    sliderDebounceRef.current = window.setTimeout(() => {
      setTimeIndex(sliderIndex);
    }, 250);
    
    return () => {
      if (sliderDebounceRef.current) {
        window.clearTimeout(sliderDebounceRef.current);
      }
    };
  }, [sliderIndex]);

  // Compute windowRange when timeIndex changes (but not when timeUnit changes,
  // as that's handled in the first useEffect)
  useEffect(() => {
    if (!timeBuckets || timeBuckets.length === 0) {
      setWindowRange(null);
      return;
    }
    
    const idx = Math.min(Math.max(0, timeIndex), timeBuckets.length - 1);
    const start = timeBuckets[idx].startMs;
    const end = computeWindowEnd(timeBuckets, idx, timeUnit);
    setWindowRange({ startMs: start, endMs: end });
  }, [timeIndex, timeBuckets]); // Removed timeUnit from dependencies!

  return {
    timeUnit,
    setTimeUnit,
    timeBuckets,
    sliderIndex,
    setSliderIndex,
    windowRange,
  };
}
