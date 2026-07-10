#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { render } from './render.js';
import type { PipelineResult } from './types.js';

const { values } = parseArgs({
  options: {
    input: {
      type: 'string',
      short: 'i',
    },
    output: {
      type: 'string',
      short: 'o',
    },
  },
});

if (!values.input) {
  console.error('Usage: aem-report --input <attribution.json> [--output <report.html>]');
  process.exit(1);
}

const inputPath = resolve(values.input);
const outputPath = values.output
  ? resolve(values.output)
  : join(dirname(inputPath), 'report.html');

const raw = await readFile(inputPath, 'utf8');
const result = JSON.parse(raw) as PipelineResult;

const html = render(result);
await writeFile(outputPath, html, 'utf8');

console.log(`Report written to ${outputPath}`);
