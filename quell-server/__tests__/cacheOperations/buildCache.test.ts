/** buildCache.ts
 
Functions to test:
createBuildCacheFromResponse
createBuildCacheFromMergedResponse
createHandleQueryCaching
Helper functions (shouldCacheResponse, extractCacheKeys)

Test strategy:
Mock normalization functions
Test different response types
Test caching scenarios

Key test cases:
Full database responses
Merged cache/database responses
Error responses
Mutation skipping
Cache key extraction
 */