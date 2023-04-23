import * as core from '@actions/core';
import { genToken } from './token';
import { upload } from './upload';

async function run(): Promise<void> {
  try {
    const ak = core.getInput('access_key');
    const sk = core.getInput('secret_key');
    const bucket = core.getInput('bucket');
    const sourceDir = core.getInput('source_dir');
    const destDir = core.getInput('dest_dir');
    const ignoreSourceMap = core.getInput('ignore_source_map') === 'true';
    const refreshUrls:string[] = JSON.parse(core.getInput('refresh_urls'));
    const refreshDirs:string[] = JSON.parse(core.getInput('refresh_dirs'));


    upload(
      bucket, ak, sk,
      sourceDir,
      destDir,
      ignoreSourceMap,
      refreshUrls,
      refreshDirs,
      (file, key) => core.info(`Success: ${file} => [${bucket}]: ${key}`),
      () => core.info('Done!'),
      (error) => core.setFailed(error.message),
    );
  } catch (error:any) {
    core.setFailed(error.message);
  }
}

run();
