/** invalidateCache.ts

Functions to test:
createClearCache
createDeleteCacheById
createClearAllCaches

Test strategy:
Mock Redis flushAll and del operations
Test ID cache clearing
Test middleware integration

Key test cases:
Complete cache flush
Single key deletion
ID cache reset
Error handling
Middleware next() calls
 */