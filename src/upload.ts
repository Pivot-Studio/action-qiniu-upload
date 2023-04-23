import qiniu from 'qiniu';
import path from 'path';
import glob from 'glob';
import pAll from 'p-all';
import pRetry from 'p-retry';
import { genToken } from './token';

function normalizePath(input: string): string {
  return input.replace(/^\//, '');
}

export function upload(
  bucket: string, ak: string, sk: string,
  srcDir: string,
  destDir: string,
  ignoreSourceMap: boolean,
  refreshUrls: string[],
  refreshDirs: string[],
  onProgress: (srcFile: string, destFile: string) => void,
  onComplete: () => void,
  onFail: (errorInfo: any) => void,
): void {
  const baseDir = path.resolve(process.cwd(), srcDir);
  const files = glob.sync(`${baseDir}/**/*`, { nodir: true });

  const config = new qiniu.conf.Config();
  const uploader = new qiniu.form_up.FormUploader(config);

  const tasks = files.map((file) => {
    const relativePath = path.relative(baseDir, path.dirname(file));
    const key = normalizePath(path.join(destDir, relativePath, path.basename(file)));

    if (ignoreSourceMap && file.endsWith('.map')) return null;

    const task = (): Promise<any> => new Promise((resolve, reject) => {
      const putExtra = new qiniu.form_up.PutExtra();
      const token = genToken(bucket, ak, sk, key);
      uploader.putFile(token, key, file, putExtra, (err, body, info) => {
        if (err) return reject(new Error(`Upload failed: ${file}, err: ${err}, body: ${body}, info: ${info}`));

        if (info.statusCode === 200) {
          onProgress(file, key);
          return resolve({ file, to: key });
        }

        reject(new Error(`Upload failed: ${file}, err: ${err}, body: ${body}, info: ${info}`));
      });
    });

    return () => pRetry(task, { retries: 3 });
  }).filter((item) => !!item) as (() => Promise<any>)[];

  pAll(tasks, { concurrency: 5 })
    .then(onComplete)
    .catch(onFail);
  const mac = new qiniu.auth.digest.Mac(ak, sk);
  let cdn = new qiniu.cdn.CdnManager(mac);
  cdn.refreshUrls(refreshUrls, function (err, body, info) {
    if (err) {
      onFail(new Error(`Refresh failed: ${err}, body: ${body}, info: ${info}`))
    }
  });
  cdn.refreshDirs(refreshDirs, function (err, body, info) {
    if (err) {
      onFail(new Error(`Refresh failed: ${err}, body: ${body}, info: ${info}`))
    }
  });
}
