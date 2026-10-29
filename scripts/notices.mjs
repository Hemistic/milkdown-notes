import { readFile, writeFile, mkdir, readdir, cp } from 'node:fs/promises';
import path from 'node:path';
/** Inventory the packages actually included by esbuild, including lazy chunks. */
export async function writeNotices(inputs) {
  const names = new Set();
  for (const input of inputs) {
    const match = input.replaceAll('\\', '/').match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/);
    if (match) names.add(match[1]);
  }
  await mkdir('licenses/third-party', { recursive: true });
  const entries = [];
  for (const name of [...names].sort()) {
    const dir = path.join('node_modules', name),
      pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    const files = (await readdir(dir)).filter((file) =>
      /^(licen[cs]e|copying|notice)(\.|$)/i.test(file),
    );
    const notices = [];
    for (const file of files) {
      const text = await readFile(path.join(dir, file), 'utf8');
      notices.push(`--- ${file} ---\n${text}`);
    }
    let supplemental = false;
    if (name === 'remark-math' && pkg.version === '6.0.0' && !files.length) {
      notices.push(
        'Source: https://raw.githubusercontent.com/remarkjs/remark-math/d5d0660b150810a535bbb07eac6cc96a4510aa24/license\n' +
          (await readFile('licenses/supplemental/remark-math.txt', 'utf8')),
      );
      supplemental = true;
    }
    const filename = name.replaceAll('/', '__') + '.txt';
    await writeFile(
      path.join('licenses/third-party', filename),
      `${name}@${pkg.version}\nDeclared license: ${JSON.stringify(pkg.license ?? pkg.licenses ?? 'not declared')}\nRepository: ${JSON.stringify(pkg.repository ?? '')}\n\n${notices.join('\n\n') || 'No root license file included in the installed npm package. Consult upstream before redistribution.'}`.trimEnd() +
        '\n',
    );
    entries.push({
      name,
      version: pkg.version,
      license: pkg.license ?? pkg.licenses ?? null,
      notice: filename,
      licenseTextPresent: files.length > 0 || supplemental,
    });
  }
  await writeFile('licenses/dependencies.json', JSON.stringify(entries, null, 2) + '\n');
  await cp('licenses', 'packages/editor/dist/licenses', { recursive: true });
  console.log(`Recorded notices for ${entries.length} bundled dependencies.`);
}
