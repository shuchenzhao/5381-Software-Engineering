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
import React from 'react';
import { TimeUnit, TimeBucket, WindowRange } from '../utils/types';
import { MAX_CLUSTER_STRENGTH } from '../utils/constants';

export interface ControlsProps {
  distanceScale: number;
  onDistanceScaleChange: (value: number) => void;
  clusterDistance: number;
  onClusterDistanceChange: (value: number) => void;
  timeUnit: TimeUnit;
  onTimeUnitChange: (unit: TimeUnit) => void;
  timeBuckets: TimeBucket[];
  sliderIndex: number;
  onSliderIndexChange: (index: number) => void;
  windowRange: WindowRange | null;
}

export function Controls({
  distanceScale,
  onDistanceScaleChange,
  clusterDistance,
  onClusterDistanceChange,
  timeUnit,
  onTimeUnitChange,
  timeBuckets,
  sliderIndex,
  onSliderIndexChange,
  windowRange,
}: ControlsProps) {
  return (
    <>
      {/* Distance and cluster controls */}
      <div style={{ display: 'flex', gap: 24, marginTop: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="distanceRange">Node distance: </label>
          <div>
            <input
              id="distanceRange"
              type="range"
              min={1}
              max={120}
              step={1}
              value={distanceScale}
              onChange={(e) => onDistanceScaleChange(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ marginLeft: 8 }}>{distanceScale}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="clusterRange">Cluster distance: </label>
          <div>
            <input
              id="clusterRange"
              type="range"
              min={0}
              max={MAX_CLUSTER_STRENGTH}
              step={0.01}
              value={clusterDistance}
              onChange={(e) => onClusterDistanceChange(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ marginLeft: 8 }}>{clusterDistance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Time-range selector */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="timeUnit">Time unit:</label>
          <select
            id="timeUnit"
            value={timeUnit}
            onChange={(e) => onTimeUnitChange(e.target.value as TimeUnit)}
            style={{ width: 120 }}
          >
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="week">Week</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <label>Selected interval: </label>
            <div style={{ fontSize: 12, textAlign: 'right', marginBottom: '3px' }}>
              {windowRange ? (
                <div>
                  {timeBuckets[sliderIndex] ? timeBuckets[sliderIndex].label : '—'}
                  {' '}
                  <span style={{ color: 'rgba(0,0,0,0.6)', marginLeft: 8 }}>
                    {new Date(windowRange.startMs).toLocaleDateString()} —{' '}
                    {new Date(windowRange.endMs).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <div style={{ color: 'rgba(0,0,0,0.5)' }}>No time buckets</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <input
              type="range"
              min={0}
              max={Math.max(0, timeBuckets.length - 1)}
              step={1}
              value={sliderIndex}
              onChange={(e) => onSliderIndexChange(Number(e.target.value))}
              style={{ width: 300 }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
