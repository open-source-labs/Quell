const joinResponses = require('../../src/helpers/joinResponses');

describe('joinResponses', () => {
  const protoObj = {
    artists: {
      __id: null,
      __args: null,
      __alias: null,
      __type: 'artists',
      id: true,
      name: true,
      instrument: true,
      albums: {
        __id: null,
        __args: null,
        __alias: null,
        __type: 'albums',
        album_id: true,
        id: true,
        name: true,
        release_year: true,
      },
    },
  };

  const protoObjShort = {
    artists: {
      id: true,
      name: true,
      instrument: true,
    },
  };

  const result = [
    {
      id: '1',
      name: 'John Coltrane',
      instrument: 'saxophone',
      albums: [
        { album_id: '1', id: '101', name: 'Blue Train', release_year: 1957 },
        { album_id: '2', id: '201', name: 'Giant Steps', release_year: 1965 },
      ],
    },
    {
      id: '2',
      name: 'Miles Davis',
      instrument: 'trumpet',
      albums: [
        { album_id: '3', id: '301', name: 'Kind of Blue', release_year: 1959 },
        {
          album_id: '4',
          id: '401',
          name: 'In a Silent Way',
          release_year: 1969,
        },
      ],
    },
    {
      id: '3',
      name: 'Thelonious Monk',
      instrument: 'piano',
      albums: [
        {
          album_id: '5',
          id: '501',
          name: 'Brilliant Corners',
          release_year: 1957,
        },
        { album_id: '6', id: '601', name: 'Monks Dream', release_year: 1963 },
      ],
    },
  ];

  test('inputs two flat response objects and outputs combined object', () => {
    const cacheResponse = {
      data: {
        artist: {
          id: '1',
          name: 'John Coltrane'
        }
      }
    };

    const serverResponse = {
      data: {
        artist: {
          instrument: 'saxophone'
        },
      }
    };

    const proto = {
      artist: {
        __id: '1',
        __args: { id: '1' },
        __alias: null,
        __type: 'artist',
        id: true,
        name: true,
        instrument: true,
      },
    };

    expect(joinResponses(cacheResponse.data, serverResponse.data, proto)).toEqual({
        artist: {
          id: '1',
          name: 'John Coltrane',
          instrument: 'saxophone'
        }
      });
  });

  test('inputs two nested response objects and outputs combined object', () => {
    const cacheResponse = {
      data: {
        artist: {
          id: '1',
          instrument: 'saxophone',
          album: {
            id:'2',
            name: 'Ring Around the Rose-y'
          },
        },
      },
    };

    const serverResponse = {
      data: {
        artist: {
          id: '1',
          name: 'John Coltrane',
          album: {
            yearOfRelease: '1800'
          },
        },
      },
    };

    const prototype = {
      artist: {
        __args: { id: 1 },
        __alias: null,
        __type: 'artist',
        id: true,
        name: false,
        instrument: true,
        album: {
          __args: { id: 2 },
          __alias: null,
          __type: 'album',
          id: true,
          name: true,
          yearOfRelease: false
        }
      }
    };
  
    expect(joinResponses(cacheResponse.data, serverResponse.data, prototype)).toEqual({
      artist: {
        id: '1',
        name: 'John Coltrane',
        instrument: 'saxophone',
        album: {
          id: '2',
          name: 'Ring Around the Rose-y',
          yearOfRelease: '1800'
        }
      }
    });
  });

  test('inputs a list retrieved from cache and a list retrieved from server and outputs combined List response', () => {
    const cacheResponse = {
      data: {
        albums: [
          { album_id: '1', id: '101', name: 'Blue Train', release_year: 1957 },
          { album_id: '2', id: '201', name: 'Giant Steps', release_year: 1965 },
        ],
      }
    };
      
    const serverResponse = {
      data: {
        albums: [
          {
            album_id: '3',
            id: '301',
            name: 'Kind of Blue',
            release_year: 1959,
          },
          {
            album_id: '4',
            id: '401',
            name: 'In a Silent Way',
            release_year: 1969,
          },
        ],
      }
    };
    
    const prototype = {
      albums: {
        __args: null,
        __alias: null,
        __type: 'albums',
        album_id: false,
        id: false,
        name: false,
        release_year: false,
      }
    };

    expect(joinResponses(cacheResponse.data, serverResponse.data, prototype)).toEqual({
      albums: [
        { album_id: '1', id: '101', name: 'Blue Train', release_year: 1957 },
        { album_id: '2', id: '201', name: 'Giant Steps', release_year: 1965 },
        { album_id: '3', id: '301', name: 'Kind of Blue', release_year: 1959 },
        { album_id: '4', id: '401', name: 'In a Silent Way', release_year: 1969 },
      ],
    });
  });

  test('inputs a list retrieved from cache and a list retrieved from server with different fields and outputs combined List response', () => {
    const cacheResponse = {
      data: {
        albums: [
          { id: '101', name: 'Blue Train' },
          { id: '201', name: 'Giant Steps' },
          { id: '301', name: 'Kind of Blue' },
          { id: '401', name: 'In a Silent Way' },
        ],
      }
    };
      
    const serverResponse = {
      data: {
        albums: [
          { album_id: '1', release_year: 1957 },
          { album_id: '2', release_year: 1965 },
          { album_id: '3', release_year: 1959 },
          { album_id: '4', release_year: 1969 },
        ],
      }
    };
    
    const prototype = {
      albums: {
        __args: null,
        __alias: null,
        __type: 'albums',
        album_id: false,
        id: false,
        name: false,
        release_year: false,
      }
    };

    expect(joinResponses(cacheResponse.data, serverResponse.data, prototype)).toEqual({
      albums: [
        { album_id: '1', id: '101', name: 'Blue Train', release_year: 1957 },
        { album_id: '2', id: '201', name: 'Giant Steps', release_year: 1965 },
        { album_id: '3', id: '301', name: 'Kind of Blue', release_year: 1959 },
        { album_id: '4', id: '401', name: 'In a Silent Way', release_year: 1969 },
      ],
    });
  });

  test('inputs a query with a nested list', () => {
    const cacheResponse = {
      data: {
        artist: {
          id: '1',
          genre: 'Pop',
          albums: [
            {
              id:'1',
              name: 'Tigermilk'
            },
            {
              id: '2',
              name: 'If You\'re Feeling Sinister'
            },
            {
              id: '3',
              name: 'The Boy With The Arab Strap'
            }
          ],
        },
      },
    };

    const serverResponse = {
      data: {
        artist: {
          id: '1',
          name: 'Belle & Sebastian',
          albums: [
            {
              yearOfRelease: '1996'
            },
            {
              yearOfRelease: '1996'
            },
            {
              yearOfRelease: '1998'
            }
          ],
        },
      },
    };

    const prototype = {
      artist: {
        __args: { id: 1 },
        __alias: null,
        __type: 'artist',
        id: true,
        name: false,
        instrument: true,
        albums: {
          __args: null,
          __alias: null,
          __type: 'albums',
          id: true,
          name: true,
          yearOfRelease: false
        }
      }
    };
  
    expect(joinResponses(cacheResponse.data, serverResponse.data, prototype)).toEqual({
      artist: {
        id: '1',
        name: 'Belle & Sebastian',
        genre: 'Pop',
        albums: [
          {
            id:'1',
            name: 'Tigermilk',
            yearOfRelease: '1996'
          },
          {
            id: '2',
            name: 'If You\'re Feeling Sinister',
            yearOfRelease: '1996'
          },
          {
            id: '3',
            name: 'The Boy With The Arab Strap',
            yearOfRelease: '1998'
          }
        ],
      },
    });
  });
});
