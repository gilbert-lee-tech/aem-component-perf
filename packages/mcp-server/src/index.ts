#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AemClient } from './aem-client.js';
import { createServer } from './server.js';

const aem = new AemClient({
  baseUrl: process.env['AEM_URL'] ?? 'http://localhost:4502',
  username: process.env['AEM_USER'] ?? 'admin',
  password: process.env['AEM_PASS'] ?? 'admin',
});

const server = createServer(aem);
await server.connect(new StdioServerTransport());
