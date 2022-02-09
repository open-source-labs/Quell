const updateProtoWithFragments = require('../../src/helpers/updateProtoWithFragments');

describe('tests for update prototype with fragments on the server side', () => {

  test('basic prototype with a fragment, should replace fragment key with fragment fields', () => {
    const protoObj = {
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        artistFragment: true,
      },
    };

    const fragment = {
      artistFragment: {
        instrument: true,
        band: true,
        hometown: true,
      },
    };

    expect(updateProtoWithFragments(protoObj, fragment)).toEqual({
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        instrument: true,
        band: true,
        hometown: true
      },
    })
  });

  test('prototype and a nested fragment, should replace fragment key with fragment fields', () => {
    const protoObj = {
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        artistFragment: true,
      },
    };

    const fragment = {
      artistFragment: {
        instrument: true,
        band: true,
        hometown: {
          name: true,
          location: true,
          __id: null,
          __args: null,
          __alias: null,
          __type: 'hometown'
        }
      },
    };

    expect(updateProtoWithFragments(protoObj, fragment)).toEqual({
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        instrument: true,
        band: true,
        hometown: {
          name: true,
          location: true,
          __id: null,
          __args: null,
          __alias: null,
          __type: 'hometown'
        }
      },
    })
  });

  test('nested prototype with a fragment, should replace fragment key with fragment fields', () => {
    const protoObj = {
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        songs: {
          songFragment: true,
          __id: null,
          __args: null,
          __alias: null,
          __type: 'song',
        }
      },
    };

    const fragment = {
      songFragment: {
        name: true,
        listens: true,
        genre: true
      },
    };

    expect(updateProtoWithFragments(protoObj, fragment)).toEqual({
      artists: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'artists',
        id: true,
        name: true,
        songs: {
          name: true,
          listens: true,
          genre: true,
          __id: null,
          __args: null,
          __alias: null,
          __type: 'song'
        }
      },
    })
  });
})