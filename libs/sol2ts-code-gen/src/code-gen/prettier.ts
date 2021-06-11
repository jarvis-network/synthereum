import prettier from 'prettier';

import { FileInfo } from './types';

export async function formatWithPrettier({
  path,
  contents,
}: FileInfo): Promise<string> {
  const prettierConfig = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(contents, {
    ...prettierConfig,
    parser: 'typescript',
  });
}
