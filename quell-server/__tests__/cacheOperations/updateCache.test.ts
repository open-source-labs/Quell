/** updateCache.ts

Functions to test:
createUpdateCacheByMutation
Helper functions (isDeleteMutation, extractDataFromResponse, findFieldsListKey)

Test strategy:
Mock Redis and cache operations
Test mutation type detection
Test cache update logic

Key test cases:
Add mutations
Update mutations (with and without ID)
Delete mutations
Field list updates
Batch updates
Error scenarios
 */