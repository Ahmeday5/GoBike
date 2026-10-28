import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The nginx CSP allows exactly one inline script (the theme bootstrap in
 * index.html) by hash. Editing that script without updating the hash would
 * break the theme silently in production — this test catches it in CI.
 */
describe('Content-Security-Policy', () => {
  const root = join(__dirname, '..');

  it('nginx script-src hash matches the inline script in index.html', () => {
    const html = readFileSync(join(root, 'src/index.html'), 'utf8');
    const nginx = readFileSync(join(root, 'docker/nginx.conf.template'), 'utf8');

    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts).toHaveLength(1);

    const hash = `sha256-${createHash('sha256').update(scripts[0]).digest('base64')}`;
    expect(nginx).toContain(`'${hash}'`);
  });
});
