module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ["dist"],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!**/__tests__/**',
    '!**/*.test.{ts,tsx}',
    '!dist/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '\\.test\\.(ts|tsx)$',
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};