export default [
  {
    input: 'src/bundle.browser.js',
    output: {
      file: 'dist/ember-plus.browser.js',
      format: 'iife',
    }
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/ember-plus.js',
      format: 'umd',
      name: 'EmberPlus',
      globals: {
        net: 'net',
        perf_hooks: 'perf_hooks',
      },
    },
    external: [ 'net', 'perf_hooks' ],
  },
];
