// Publishes dist/ to the gh-pages branch, which GitHub Pages serves at
// https://salazarvroen.github.io/luna-landing/. Run with `npm run deploy` (it builds first).
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd = 'dist') => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();

if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run the build first');
writeFileSync('dist/.nojekyll', ''); // serve files as they are, no Jekyll processing

run('git init -q -b gh-pages');
run('git add -A');
run(`git -c user.name="LunaOS deploy" -c user.email="deploy@lunaos.invalid" commit -q -m "Deploy ${new Date().toISOString()}"`);
run(`git push -f ${remote} gh-pages`);
console.log('\nDeployed. Live in a minute at https://salazarvroen.github.io/luna-landing/');
