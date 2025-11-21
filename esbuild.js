const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension/main.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
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
