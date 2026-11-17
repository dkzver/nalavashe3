import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const OUT = resolve(root, 'lava-dash-standalone.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')],
  bundle: true,
  write: false,
  outfile: resolve(root, '.lava-dash-standalone.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'safari15'],
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      // CSS встраиваем отдельным <style>, чтобы не зависеть от внешних файлов.
      name: 'ignore-css',
      setup(buildApi) {
        buildApi.onResolve({ filter: /\.css$/ }, (args) => ({
          path: args.path,
          namespace: 'ignore-css',
        }));
        buildApi.onLoad({ filter: /.*/, namespace: 'ignore-css' }, () => ({
          contents: '',
          loader: 'js',
        }));
      },
    },
  ],
});

const jsFile = result.outputFiles[0];
if (!jsFile) throw new Error('Не удалось получить JS-бандл');

const js = jsFile.text.replace(/<\/script/gi, '<\\/script');
const css = (await readFile(resolve(root, 'src/style.css'), 'utf8')).replace(/<\/style/gi, '<\\/style');
const favicon = await readFile(resolve(root, 'public/assets/favicon.svg'), 'utf8');
const faviconUrl = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

let html = await readFile(resolve(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="icon"[^>]*>/i, `<link rel="icon" href="${faviconUrl}" type="image/svg+xml" />`);
html = html.replace(/<link rel="stylesheet"[^>]*>/gi, '');
html = html.replace('</head>', () => `    <style>\n${css}\n    </style>\n  </head>`);

const scriptPattern = /<script\b[^>]*src="\/src\/main\.js"[^>]*><\/script>/i;
if (!scriptPattern.test(html)) throw new Error('В index.html не найден модульный скрипт main.js');
html = html.replace(scriptPattern, () => `<script>\n${js}\n    </script>`);

html = html.replace(
  '<title>LAVA DASH',
  '<!-- Автономная сборка: открывается двойным щелчком, без сервера. -->\n    <title>LAVA DASH',
);

const rootRelative = [...html.matchAll(/(?:src|href)="\/[^"]+"/g)];
if (rootRelative.length) {
  throw new Error(`Остались абсолютные ссылки: ${rootRelative.map((match) => match[0]).join(', ')}`);
}

await mkdir(resolve(root, 'dist-standalone'), { recursive: true });
await writeFile(OUT, html, 'utf8');
await writeFile(resolve(root, 'dist-standalone/index.html'), html, 'utf8');

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} КБ`;
console.log(`Автономная сборка: ${OUT} (${kb(Buffer.byteLength(html))})`);
console.log(`Копия для раздачи: dist-standalone/index.html`);
