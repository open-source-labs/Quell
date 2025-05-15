/** writeCache.ts

Functions to test:
createWriteToCache
createNormalizeForCache
createUpdateIdCache

Test strategy:
Mock Redis operations
Test normalization with various data structures
Test ID cache updates
Test expiration settings

Key test cases:
Writing different data types (objects, arrays, scalars)
Uncacheable key handling
Normalization of nested objects
Array data normalization
ID extraction from different field names
Cache expiration functionality
 */