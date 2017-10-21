import * as crypto from 'crypto';
import * as tsc from 'typescript';
import { JestConfig, Path, TransformOptions } from './jest-types';
import { getPostProcessHook } from './postprocess';
import { cacheFile, getTSConfig, getTSJestConfig } from './utils';

export function process(
  src: string,
  filePath: Path,
  jestConfig: JestConfig,
  transformOptions: TransformOptions = { instrument: false },
) {
  // transformOptions.instrument is a proxy for collectCoverage
  // https://github.com/kulshekhar/ts-jest/issues/201#issuecomment-300572902
  const compilerOptions = getTSConfig(
    jestConfig.globals,
    transformOptions.instrument,
  );
  const tsJestConfig = getTSJestConfig(jestConfig.globals);

  const isTsFile = /\.tsx?$/.test(filePath);
  const isJsFile = /\.jsx?$/.test(filePath);
  const isHtmlFile = /\.html$/.test(filePath);

  const postHook = getPostProcessHook(
    compilerOptions,
    jestConfig,
    tsJestConfig,
  );

  if (isHtmlFile && jestConfig.globals.__TRANSFORM_HTML__) {
    src = 'module.exports=`' + src + '`;';
  }

  const processFile =
    compilerOptions.allowJs === true ? isTsFile || isJsFile : isTsFile;

  if (processFile) {
    const tsTranspiled = tsc.transpileModule(src, {
      compilerOptions,
      fileName: filePath,
    });

    const outputText = postHook(
      tsTranspiled.outputText,
      filePath,
      jestConfig,
      transformOptions,
    );

    const start = outputText.length > 12 ? outputText.substr(1, 10) : '';

    const modified =
      start === 'use strict'
        ? `'use strict';require('ts-jest').install();${outputText}`
        : `require('ts-jest').install();${outputText}`;

    cacheFile(jestConfig, filePath, modified);

    return modified;
  }

  return src;
}

export function getCacheKey(
  fileData: string,
  filePath: Path,
  configStr: string,
  options: TransformOptions = { instrument: false },
): string {
  const jestConfig: JestConfig = JSON.parse(configStr);
  const tsConfig = getTSConfig(jestConfig.globals, options.instrument);

  return crypto
    .createHash('md5')
    .update(JSON.stringify(tsConfig), 'utf8')
    .update(JSON.stringify(options), 'utf8')
    .update(fileData + filePath + configStr, 'utf8')
    .digest('hex');
}
