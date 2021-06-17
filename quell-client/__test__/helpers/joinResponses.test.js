const joinResponses = require('../../src/helpers/joinResponses');

describe('joinResponses', () => {
  const protoObj = {
    artists: {
      id: true,
      name: true,
      instrument: true,
      albums: {
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

  xtest('inputs two flat response objects and outputs combined object', () => {
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

  xtest('inputs two nested response objects and outputs combined object', () => {
    const cacheResponse = {
      data: {
        artist: {
          id: '1',
          instrument: 'saxophone',
          topAlbum: {
            id:'1',
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
          topAlbum: {
            yearOfRelease: '1800'
          },
        },
      },
    };

    const prototype = {
      artist: {
        id: true,
        name: false,
        instrument: true,
        topAlbum: {
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
        topAlbum: {
          id: '1',
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

  xtest('inputs a list retrieved from cache and a list retrieved from server with different fields and outputs combined List response', () => {
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

  xtest('inputs two arrays (scalar <<< non-scalar) and outputs combined array', () => {
    const scalar3 = [
      { id: '1', name: 'John Coltrane' },
      { id: '2', name: 'Miles Davis' },
      { id: '3', name: 'Thelonious Monk' },
    ];

    const nonScalar3 = [
      {
        albums: [
          { album_id: '1', id: '101', name: 'Blue Train', release_year: 1957 },
          { album_id: '2', id: '201', name: 'Giant Steps', release_year: 1965 },
        ],
        instrument: 'saxophone',
      },
      {
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
        instrument: 'trumpet',
      },
      {
        albums: [
          {
            album_id: '5',
            id: '501',
            name: 'Brilliant Corners',
            release_year: 1957,
          },
          { album_id: '6', id: '601', name: 'Monks Dream', release_year: 1963 },
        ],
        instrument: 'piano',
      },
    ];

    expect(joinResponses(scalar3, nonScalar3, protoObj)).toEqual(result);
  });

  xtest('inputs two arrays (non-scalar <<< non-scalar) and outputs combined array', () => {
    const nonScalar4 = [
      {
        id: '1',
        name: 'John Coltrane',
        albums: [
          { album_id: '1', id: '101', release_year: 1957 },
          { album_id: '2', id: '201', release_year: 1965 },
        ],
      },
      {
        id: '2',
        name: 'Miles Davis',
        albums: [
          { album_id: '3', id: '301', release_year: 1959 },
          { album_id: '4', id: '401', release_year: 1969 },
        ],
      },
      {
        id: '3',
        name: 'Thelonious Monk',
        albums: [
          { album_id: '5', id: '501', release_year: 1957 },
          { album_id: '6', id: '601', release_year: 1963 },
        ],
      },
    ];

    const nonScalar5 = [
      {
        albums: [{ name: 'Blue Train' }, { name: 'Giant Steps' }],
        instrument: 'saxophone',
      },
      {
        albums: [{ name: 'Kind of Blue' }, { name: 'In a Silent Way' }],
        instrument: 'trumpet',
      },
      {
        albums: [{ name: 'Brilliant Corners' }, { name: 'Monks Dream' }],
        instrument: 'piano',
      },
    ];

    expect(joinResponses(nonScalar4, nonScalar5, protoObj)).toEqual(result);
  });

  xtest('two arrays', () => {
    const cacheResponse = {
      data: {
        artists: [
          { id: '1', name: 'John Coltrane' },
          { id: '2', name: 'Miles Davis' },
          { id: '3', name: 'Thelonious Monk' },
        ]
      }
    };

    const serverResponse = {
      data: {
        artists: [
          { instrument: 'saxophone' },
          { instrument: 'trumpet' },
          { instrument: 'piano' },
        ]
      }
    };
  })
});
