module.exports = {
  extends: 'plugin:ava/recommended',
  plugins: [ 'ava' ],
  rules: {
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
  },
};
