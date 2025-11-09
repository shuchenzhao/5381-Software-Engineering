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
import assert from 'assert';
import transformProps from '../../src/plugin/transformProps';

describe('CollabForcedirected transformProps', () => {
  const formData = {
    boldText: true,
    headerFontSize: 'xs',
    headerText: 'my text',
  } as any;
  const chartProps: any = {
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data: [] }], // force internal mock
  };

  it('should produce nodes and links from mock events', () => {
    const out = transformProps(chartProps) as any;
    assert.strictEqual(out.width, 800);
    assert.strictEqual(out.height, 600);
    assert.ok(Array.isArray(out.nodes));
    assert.ok(Array.isArray(out.links));
    const ids = out.nodes.map((n: any) => n.id);
    ['alice', 'bob', 'carol', 'dave'].forEach((id) => assert.ok(ids.includes(id)));
    const pairKey = ['alice', 'carol'].sort().join('||');
    const found = out.links.find((l: any) => [l.source, l.target].sort().join('||') === pairKey);
    assert.ok(found, 'expected link between alice and carol');
    assert.ok((found.types.reviews || found.types.commits || found.types.discussion) > 0);
  });
});
