#!/usr/bin/env node
/*
 * Simple mock data generator for the collaboration graph plugin.
 * Produces JSON array of rows compatible with Superset's queriesData[0].data
 * Each row has: source, target, weight, timestamp
 */

const fs = require('fs');
const path = require('path');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateNodes(count) {
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push(`user_${i + 1}`);
  }
  return names;
}

function generateEdges(nodes, edgeCount, maxWeight = 10) {
  const edges = [];
  for (let i = 0; i < edgeCount; i++) {
    const a = sample(nodes);
    let b = sample(nodes);
    // ensure no self-edge
    while (b === a) {
      b = sample(nodes);
    }
    edges.push({
      source: a,
      target: b,
      weight: randInt(1, maxWeight),
      // ISO timestamp within last 90 days
      timestamp: new Date(Date.now() - randInt(0, 90) * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return edges;
}

function mergeEdges(edges) {
  // combine edges between same pair into single rows with summed weight
  const map = new Map();
  for (const e of edges) {
    const key = `${e.source}||${e.target}`;
    if (!map.has(key)) map.set(key, { ...e });
    else {
      const existing = map.get(key);
      existing.weight += e.weight;
      // keep most recent timestamp
      if (new Date(e.timestamp) > new Date(existing.timestamp)) {
        existing.timestamp = e.timestamp;
      }
    }
  }
  return Array.from(map.values());
}

function generate({ nodes = 10, edges = 30, maxWeight = 5 } = {}) {
  const nodeNames = generateNodes(nodes);
  const raw = generateEdges(nodeNames, edges, maxWeight);
  return mergeEdges(raw);
}

function main() {
  const argv = require('minimist')(process.argv.slice(2));
  const nodes = parseInt(argv.nodes || argv.n || '10', 10);
  const edges = parseInt(argv.edges || argv.e || '30', 10);
  const maxWeight = parseInt(argv.maxWeight || argv.w || '5', 10);
  const out = argv.out || argv.o || 'mock_data.json';

  const data = generate({ nodes, edges, maxWeight });
  const outPath = path.resolve(process.cwd(), out);
  fs.writeFileSync(outPath, JSON.stringify({ data }, null, 2));
  console.log(`Wrote ${data.length} edge rows to ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { generate, generateNodes, generateEdges, mergeEdges };
