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

export interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

export function Tooltip({ visible, x, y, content }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '6px 8px',
        borderRadius: 4,
        fontSize: 12,
        pointerEvents: 'none',
        whiteSpace: 'pre',
        maxWidth: 300,
        zIndex: 10,
      }}
    >
      {content}
    </div>
  );
}
