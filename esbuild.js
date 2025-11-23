const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const entryPoint = path.join(__dirname, 'src', 'extension', 'main.ts');

if (!fs.existsSync(entryPoint)) {
  console.error(`Error: Entry point not found at ${entryPoint}`);
  process.exit(1);
}

async function main() {
  const ctx = await esbuild.context({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    target: 'node20',
    outfile: 'out/extension/main.js',
    external: ['vscode'],
    logLevel: 'info',
    treeShaking: true,
    metafile: production,
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    
    if (production) {
      console.log('Build complete!');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
