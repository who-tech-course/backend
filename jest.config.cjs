/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|js)$': ['@swc/jest', { jsc: { target: 'es2022' } }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@octokit)/)'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
};
