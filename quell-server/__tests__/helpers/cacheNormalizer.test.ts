import { normalizeNode } from '../../src/helpers/cacheNormalizer';
import * as cacheUtils from '../../src/helpers/cacheUtils';
import { ProtoObjType, QueryMapType } from '../../src/types/types';

jest.mock('../../src/helpers/cacheUtils', () => ({
  getCacheID: jest.fn(),
}));

describe('normalizeNode', () => {
  const mockProto: ProtoObjType = {
    country: {
      __type: 'country',
      __args: { id: '1' },
    },
  };

  const mockQueryMap: QueryMapType = {
    country: ['id', 'name', 'capitol'],
  };

  beforeEach(() => {
    (cacheUtils.getCacheID as jest.Mock).mockReturnValue('country--1');
  });

  it('returns a cacheID and payload with no "__" fields', () => {
    const result = normalizeNode(
      'country',
      {
        id: '1',
        name: 'Canada',
        __typename: 'Country',
        capitol: 'Ottawa',
      },
      mockProto,
      'Query',
      mockQueryMap
    );

    expect(result).toEqual({
      cacheID: 'country--1',
      payload: {
        id: '1',
        name: 'Canada',
        capitol: 'Ottawa',
      },
    });

    expect(cacheUtils.getCacheID).toHaveBeenCalledWith(mockProto, mockQueryMap);
  });

  it('returns an empty payload when all fields start with "__"', () => {
    const result = normalizeNode(
      'country',
      {
        __typename: 'Country',
        __meta: 'data',
      },
      mockProto,
      'Query',
      mockQueryMap
    );

    expect(result.payload).toEqual({});
  });
});
