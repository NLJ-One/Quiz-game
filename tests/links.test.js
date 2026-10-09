import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(projectRoot, 'web');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function isExternal(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
}

function resolveReference(reference, sourcePath) {
  const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  if (!pathname || pathname.startsWith('#') || isExternal(reference)) return null;
  return pathname.startsWith('/')
    ? path.join(webRoot, pathname.slice(1))
    : path.resolve(path.dirname(sourcePath), pathname);
}

const htmlFiles = walk(webRoot).filter((file) => file.endsWith('.html'));
const jsFiles = walk(webRoot).filter((file) => file.endsWith('.js'));

test('all local href, src, and JavaScript module imports resolve to existing files', () => {
  const missing = [];

  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const resolved = resolveReference(match[1], htmlPath);
      if (resolved && !existsSync(resolved)) {
        missing.push(`${path.relative(projectRoot, htmlPath)} -> ${match[1]}`);
      }
    }
  }

  for (const jsPath of jsFiles) {
    const source = readFileSync(jsPath, 'utf8');
    const imports = [
      ...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
    ];
    for (const match of imports) {
      const resolved = resolveReference(match[1], jsPath);
      if (resolved && !existsSync(resolved)) {
        missing.push(`${path.relative(projectRoot, jsPath)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test('every page loads the shared styles, its page styles, and exactly one module entry point', () => {
  const expectedStyles = new Map([
    ['index.html', ['/css/home.css']],
    ['join.html', ['/css/play.css']],
    ['play.html', ['/css/play.css']],
    ['host.html', ['/css/host.css', '/css/leaderboard.css']],
    ['editor.html', ['/css/editor.css']]
  ]);
  const expectedPages = new Set(expectedStyles.keys());

  assert.deepEqual(
    new Set(htmlFiles.map((file) => path.basename(file))),
    expectedPages
  );

  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, 'utf8');
    const page = path.basename(htmlPath);
    const stylesheetPaths = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["']/gi)]
      .map((match) => match[1]);
    const moduleScripts = [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/gi)];

    assert.deepEqual(stylesheetPaths.slice(0, 2), ['/css/base.css', '/css/theme.css'], `${page} shared stylesheet order`);
    for (const stylesheet of expectedStyles.get(page)) {
      assert.ok(stylesheetPaths.includes(stylesheet), `${page} includes ${stylesheet}`);
    }
    assert.equal(moduleScripts.length, 1, `${page} has exactly one module script`);
    assert.match(moduleScripts[0][1], /^\/js\/[^/]+\/main\.js$/, `${page} uses a page main.js`);
    assert.match(html, /<meta\s+name=["']viewport["']\s+content=["']width=device-width, initial-scale=1, viewport-fit=cover["']/i, `${page} viewport`);
    assert.match(html, /<meta\s+name=["']theme-color["']/i, `${page} theme color`);
    assert.match(html, /<link\b[^>]*rel=["']manifest["'][^>]*href=["']\/manifest\.webmanifest["']/i, `${page} manifest`);
  }
});
