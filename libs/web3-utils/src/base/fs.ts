import { promises as fs } from 'fs';

export async function writeJsonToFile(filePath: string, json: any) {
  return await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n');
}

export async function readJsonFromFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}
