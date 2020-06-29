export default [
  {
    input: 'src/index.browser.esm.js',
    output: {
      file: 'dist/ember-plus.browser.js',
      format: 'umd',
      name: 'EmberPlus',
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
      },
    },
    external: [ 'net' ],
  },
];