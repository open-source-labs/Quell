module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ["dist"],
  forceCoverageMatch: ['**/*.test.js'],
  collectCoverage: true,
};