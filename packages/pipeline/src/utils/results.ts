import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function saveRunResult(
  resultsDir: string,
  pageId: string,
  runIndex: number,
  lhrJson: string,
): Promise<string> {
  const dir = join(resultsDir, pageId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${runIndex}.json`);
  await writeFile(filePath, lhrJson, 'utf8');
  return filePath;
}

export async function loadRunResult(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}
