/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
import * as ts from 'typescript';

import { assertNotNull } from '@jarvis-network/core-utils/dist/base/asserts';

export function compileTypeScriptFiles({
  files,
  tsConfigDir,
}: {
  files: string[];
  tsConfigDir: string;
}): void {
  console.log('[In-memory TS]: Compiling:', files);
  const configFile = ts.findConfigFile(
    tsConfigDir,
    ts.sys.fileExists,
    'tsconfig.json',
  );

  const { config } = ts.readConfigFile(
    assertNotNull(configFile, `tsconfig.json file not found '${tsConfigDir}'`),
    ts.sys.readFile,
  );

  const { options, errors } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    tsConfigDir,
  );

  const outDir = assertNotNull(
    options.outDir,
    'tsconfig.json: `outDir` must be specified',
  );

  if (files.every(x => x.startsWith(outDir))) {
    // Necessary to prevent:
    //    libs/contracts/dist/src/contracts/abi/index.ts ->
    //    libs/contracts/dist/dist/src/contracts/abi/index.js
    options.outDir = tsConfigDir;
  }

  const program = ts.createProgram({
    options,
    rootNames: files,
    configFileParsingDiagnostics: errors,
  });

  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        assertNotNull(diagnostic.start),
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${
          character + 1
        }): ${message}`,
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      );
    }
  });

  if (emitResult.emitSkipped) throw Error('TS compilation failed.');
}
