import { promises as fs } from 'fs';

export function writeJsonToFile(
  filePath: string,
  json: unknown,
): Promise<void> {
  return fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

export async function readJsonFromFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}
