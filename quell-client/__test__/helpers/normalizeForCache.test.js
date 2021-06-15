const normalizeForCache = require('../../src/helpers/normalizeForCache');

// normalizeForCache does not return any values, rather writes to the cache
// way to mock sessionStorage like in buildFromCache tests?

xdescribe('normalizeForCache.test.js', () => {
  test.skip('normalizeForCache.test.js', () => {
    expect(normalizeForCache()).toEqual({});
  });
});
