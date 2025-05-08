module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ["dist"],
  forceCoverageMatch: ['**/*.test.(ts|js)'],
  collectCoverage: true,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};