import { createQueryStr, createQueryObj, joinResponses, parseAST, updateProtoWithFragment, getMutationMap, getQueryMap, getFieldsMap } from '../../src/helpers/quellHelpers';

import schema from '../../test-config/testSchema';
import schemaWithoutMuts from '../../test-config/testSchemaWithoutMuts';
import schemaWithoutQueries from '../../test-config/testSchemaWithoutQueries';
import schemaWithoutFields from "../../test-config/testSchemaWithoutFields";

import { parse } from 'graphql/language/parser';



//*Legacy Test Suite for createQueryStr from quellHelpers
describe("server side tests for createQueryStr.js", () => {
  test("inputs query object w/ no values", () => {
    const queryObject = {};

    expect(createQueryStr(queryObject)).toEqual("");
  });

  test("inputs query object w/ only scalar types and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: "countries",
        id: false,
        name: false,
        capitol: false,
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol } }`
    );
  });

  test("inputs query object w/ only nested objects and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: "countries",
        __alias: null,
        __args: {},
        cities: {
          __id: null,
          __type: "cities",
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { cities { id country_id name population } } }`
    );
  });

  test("inputs query object w/ both scalar & object types and outputs GQL query string", () => {
    const queryObject = {
      countries: {
        __id: null,
        __type: "countries",
        __alias: null,
        __args: {},
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __type: "cities",
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id name capitol cities { id country_id name } } }`
    );
  });

  test("inputs query object w/ an argument & w/ both scalar & object types should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: "1",
        __type: "country",
        __alias: null,
        __args: { id: "1" },
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __type: "cities",
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ country(id: "1") { id name capitol cities { id country_id name population } } }`
    );
  });

  test("inputs query object w/ multiple arguments & w/ both scalar & object types should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: null,
        __type: "country",
        __alias: null,
        __args: {
          name: "China",
          capitol:"Beijing",
        },
        id: false,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __type: "cities",
          __alias: null,
          __args: {},
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ country(name: "China", capitol: "Beijing") { id name capital cities { id country_id name population } } }`
    );
  });

  test("inputs query object with alias should output GQL query string", () => {
    const queryObject = {
      Canada: {
        __id: "3",
        __type: "country",
        __args: { id: "3" },
        __alias: "Canada",
        id: false,
        cities: {
          __id: null,
          __type: "cities",
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: "3") { id cities { id name } } }`
    );
  });

  test("inputs query object with nested alias should output GQL query string", () => {
    const queryObject = {
      Canada: {
        __type: "country",
        __args: { id: 3 },
        __alias: "Toronto",
        id: false,
        Toronto: {
          __type: "city",
          __args: { id: 5 },
          __alias: "Toronto",
          id: false,
          name: false,
        },
      },
    };
    
    expect(createQueryStr(queryObject)).toEqual(
      `{ Canada: country(id: "3") { id Toronto: city(id: "5") { id name } } }`
    );
  });

  test("inputs query object with multiple queries should output GQL query string", () => {
    const queryObject = {
      country: {
        __id: "1",
        __type: "country",
        __args: { id: "1" },
        __alias: null,
        id: false,
        name: false,
        cities: {
          __id: null,
          __type: "cities",
          __args: {},
          __alias: null,
          id: false,
          name: false,
        },
      },
      book: {
        __id: "2",
        __type: "book",
        __args: { id: "2" },
        __alias: null,
        id: false,
        title: false,
        author: {
          __id: null,
          __type: "author",
          id: false,
          name: false,
          __args: {},
          __alias: null,
        },
      },
    };

    expect(createQueryStr(queryObject)).toEqual(
      `{ country(id: "1") { id name cities { id name } } book(id: "2") { id title author { id name } } }`
    );
  });

  test("deeply nested query object", () => {
    const queryObject = {
      countries: {
        id: true,
        __type: "countries",
        __alias: null,
        __args: {},
        __id: null,
        cities: {
          id: true,
          __type: "cities",
          __alias: null,
          __args: {},
          __id: null,
          attractions: {
            id: true,
            __type: "attractions",
            __alias: null,
            __args: {},
            __id: null,
            location: {
              id: true,
              __type: "location",
              __alias: null,
              __args: {},
              __id: null,
              latitude: {
                id: true,
                __type: "latitude",
                __alias: null,
                __args: {},
                __id: null,
                here: {
                  id: true,
                  __type: "here",
                  __alias: null,
                  __args: {},
                  __id: null,
                  not: {
                    id: true,
                    __type: "not",
                    __alias: null,
                    __args: {},
                    __id: null,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(createQueryStr(queryObject)).toEqual(
      `{ countries { id cities { id attractions { id location { id latitude { id here { id not { id } } } } } } } }`
    );
  });
});

//*Legacy Test Suite for createQueryObj from quellHelpers
describe('server side tests for createQueryObj.js', () => {

  // TO-DO: Add the same test to the client side test folder
  test('inputs prototype w/ all true should output empty object', () => {
    const prototype = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: true,
        capitol: true,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(prototype)).toEqual({});
  });

  test('inputs prototype w/ only false scalar types should output same object', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    });
  });

  test('inputs prototype w/ false for only scalar types should output object for scalar types only', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capitol: false,
      },
    });
  });

  test('inputs prototype w/ false for only object types should output object for object types only', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: true,
        capital: true,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        id: false,
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    });
  });

  test('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
    const map = {
      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: true,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: true,
          country_id: false,
          name: true,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      countries: {
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
        name: false,
        capital: false,
        cities: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'cities',
          id: false,
          country_id: false,
          population: false,
        },
      },
    });
  });

  test('inputs prototype with multiple queries', () => {
    const map = {
      Canada: {
        __id: '1',
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        id: true,
        name: false,
        capitol: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'capitol',
          id: false,
          name: true,
          population: false,
        },
      },
      Mexico: {
        __id: '2',
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        id: true,
        name: false,
        climate: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'climate',
          seasons: true,
          id: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      Canada: {
        __id: '1',
        __type: 'country',
        name: false,
        id: false,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: false,
          population: false,
          __alias: null,
          __args: {},
          __type: 'capitol',
          __id: null,
        },
      },
      Mexico: {
        name: false,
        id: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        __id: '2',
      },
    });
  });

  test('test requests with multiple queries in which half of the request if managed by the cache and the other half is managed by the response', () => {
    const map = {
      Canada: {
        __id: '1',
        __alias: 'Canada',
        __args: { id: '1' },
        __type: 'country',
        id: true,
        name: true,
        capitol: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'capitol',
          id: true,
          name: true,
          population: true,
        },
      },
      WarBook: {
        __id: '2',
        __alias: 'WarBook',
        __args: { id: '10' },
        __type: 'book',
        id: false,
        name: false,
        author: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'author',
          id: false,
          name: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({

      WarBook: {
        __id: '2',
        __alias: 'WarBook',
        __args: { id: '10' },
        __type: 'book',
        id: false,
        name: false,
        author: {
          __id: null,
          __alias: null,
          __args: {},
          __type: 'author',
          name: false,
          id: false,
        },
      },
    });
  });
});

//*Legacy Test Suite for joinResponses from quellHelpers
describe('tests for joinResponses on the server side', () => {
  
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
          __id: '1',
          __args: { id: '1' },
          __alias: null,
          __type: 'artist',
          id: true,
          name: false,
          instrument: true,
          album: {
            __id: '2',
            __args: { id: '2' },
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
          __id: null,
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
          __id: null,
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
  
    test('queries when the server and the response contain different piece of data relevant to the client request', () => {
      const cacheResponse = {
        data: {
          artist: {
            id: '1',
            instrument: 'saxophone',
            name: 'John Coltrane',
            album: {
              id:'2',
              name: 'Ring Around the Rose-y',
              yearOfRelease: '1800'
            },
          },
        },
      };
  
      const serverResponse = {
        data: {
          author: {
            id: '10',
            name: 'Jeane Steinbeck',
            book: {
              name: 'Crepes of Wrath',
              year: '1945'
            },
          },
        },
      };
  
      const prototype = {
        artist: {
          __id: '1',
          __args: { id: '1' },
          __alias: null,
          __type: 'artist',
          id: true,
          name: true,
          instrument: true,
          album: {
            __id: '2',
            __args: { id: '2' },
            __alias: null,
            __type: 'album',
            id: true,
            name: true,
            yearOfRelease: true
          }
        },
        author: {
          __id: '10',
          __args: { id: '10' },
          __alias: null,
          __type: 'author',
          id: false,
          name: false,
          book: {
            __id: null,
            __args: { },
            __alias: null,
            __type: 'book',
            name: false,
            year: false
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
        }, 
        author: {
          id: '10',
          name: 'Jeane Steinbeck',
          book: {
            name: 'Crepes of Wrath',
            year: '1945'
          },
        }
      });
    })
  
    // TO-DO: test for alias compatibility (should be fine- server & bFC both create objects with alias as keys)
});

//*Legacy Test Suite for parseAST from quellHelpers
describe('server tests for parseAST', () => {

  test('should traverse the abstract syntax tree and create a proto object', () => {
    // define a query string
    const query = `query {
      countries {
        id
        name
        capitol
      }
    }`;
    // parse query, and parse AST
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    // compare expected proto & operation Type to actual
    expect(proto).toEqual({
      countries: {
        id: true,
        name: true,
        capitol: true,
        __args: null,
        __alias: null,
        __type: 'countries',
        __id: null,
      },
    });
    expect(operationType).toBe('query');
  });

  test('should return a proto from a nested query', () => {
    const query = `query {
      countries {
         id
         name
         capitol
         cities {
            id
            country_id
            name
            population
          }
        }
      }`;

    const AST = parse(query);
    const { proto, operationType } = parseAST(AST);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capitol: true,
        cities: {
          __type: 'cities',
          __args: null,
          __alias: null,
          __id: null,
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should work with multiple arguments', () => {
    const query = `query {
      country(id: 1, name: "USA") {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      country: {
        __type: 'country',
        __args: { id: '1', name: 'USA' },
        __alias: null,
        __id: '1',
        id: true,
        name: true,
        capitol: true,
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should create proto that stores alias information', () => {
    const query = `{
      Canada: country (id: 1) {
        id
        name
        capitol
      }
  }`;
    const AST = parse(query);
    const { proto, operationType } = parseAST(AST);

    expect(proto).toEqual({
      Canada: {
        __type: 'country',
        __args: { id: '1' },
        __alias: 'Canada',
        __id: '1',
        id: true,
        name: true,
        capitol: true,
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should reject query without id for', () => {
    const query = `{
      countries { 
        id 
        name 
        capital 
      } 
      book {
        name
        genre
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capital: true,
      },
    });
    expect(operationType).toEqual('unQuellable');
  });

  test('should create proto object for multiple queries', () => {
    const query = `{
      countries { 
        id 
        name 
        capital 
      } 
      book {
        id
        name
        genre
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        capital: true,
      },
      book: {
        __type: 'book',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        genre: true,
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should create proto object for multiple nested queries', () => {
    const query = `{
      countries { 
        id 
        name 
        cities {
          id
          name
        } 
      } 
      book {
        id
        name
        genre
        similarBooks {
          id
          name
        }
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        cities: {
          __type: 'cities',
          __args: null,
          __alias: null,
          __id: null,
          name: true,
          id: true,
        },
      },
      book: {
        __type: 'book',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        genre: true,
        similarBooks: {
          __type: 'similarbooks',
          __args: null,
          __alias: null,
          __id: null,
          name: true,
          id: true,
        },
      },
    });
    expect(operationType).toBe('query');
  });

  test('should create proto for query with nested arguments', () => {
    const query = `query {
      country(id: 1) {
        id
        name
        city(id: 2) {
          id
          name
        }
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      country: {
        __type: 'country',
        __args: { id: '1' },
        __alias: null,
        __id: '1',
        id: true,
        name: true,
        city: {
          __type: 'city',
          __args: { id: '2' },
          __alias: null,
          __id: '2',
          id: true,
          name: true,
        },
      },
    });
    expect(operationType).toBe('query');
  });

  test('EDGE- should create proto for query with alias even without arguments', () => {
    const query = `query {
      Canada: country {
        id
        name
      }
    }`;

    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      Canada: {
        __type: 'country',
        __args: null,
        __alias: 'Canada',
        __id: null,
        id: true,
        name: true,
      },
    });
    expect(operationType).toBe('query');
  });

  test('should create proto for query with nested aliases & arguments', () => {
    const query = `query { 
      countries {
        id
        name
        Toronto: city(id: 1) {
          id
          name
          IceCream: food(id: 2) {
            id
            name
            nutrition(id: 3) {
              id
              calories,
              protein,
              fat,
              carbs
            }
          }
        }
      }
    }`;

    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      countries: {
        __type: 'countries',
        __args: null,
        __alias: null,
        __id: null,
        id: true,
        name: true,
        Toronto: {
          __type: 'city',
          __args: { id: '1' },
          __alias: 'Toronto',
          __id: '1',
          id: true,
          name: true,
          IceCream: {
            __type: 'food',
            __args: { id: '2' },
            __alias: 'IceCream',
            __id: '2',
            id: true,
            name: true,
            nutrition: {
              __type: 'nutrition',
              __args: { id: '3' },
              __alias: null,
              __id: '3',
              id: true,
              calories: true,
              protein: true,
              fat: true,
              carbs: true,
            },
          },
        },
      },
    });
    expect(operationType).toBe('query');
  });

  test('should add type-specific options to proto when supplied', () => {
    const query = `query {
      country(id: 1, name: "USA", __cacheTime: 1000) {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { proto, operationType } = parseAST(parsedQuery);

    expect(proto).toEqual({
      country: {
        __type: 'country',
        __args: { id: '1', name: 'USA' },
        __alias: null,
        // __cacheTime: '1000',
        __id: '1',
        id: true,
        name: true,
        capitol: true,
      },
    });
    expect(operationType).toEqual('query');
  });

  test('should create proto for query with fragments', () => {
    const query = `query { 
      Canada: country {
        id
        name
        ...CountryInfo
      }
    }
    fragment CountryInfo on country {
      capitol,
      population
    }`;

    const parsedQuery = parse(query);
    const { proto, operationType, frags } = parseAST(parsedQuery);

    expect(proto).toEqual({
      Canada: {
        __id: null,
        __type: 'country',
        __args: null,
        __alias: 'Canada',
        id: true,
        name: true,
        CountryInfo: true,
      },
    });
    expect(frags).toEqual({
      CountryInfo: {
        capitol: true,
        population: true,
      },
    });
    expect(operationType).toBe('query');
  });

  test('should not work with directive operation types', () => {
    const query = `subscription {
      country(id: 1, name: "USA") {
        id
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { operationType } = parseAST(parsedQuery);

    expect(operationType).toEqual('unQuellable');
  });

  test('should not work with variables', () => {
    const query = `query {
      country(id: 1, name: "USA") {
        id
        __name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { operationType } = parseAST(parsedQuery);

    expect(operationType).toEqual('unQuellable');
  });

  test('should not work with queries without an ID', () => {
    const query = `query {
      country(name: "USA") {
        name
        capitol
      }
    }`;
    const parsedQuery = parse(query);
    const { operationType } = parseAST(parsedQuery);

    expect(operationType).toEqual('noID');
  });
});

//*Legacy Test Suite for updateProtoWithFragment from quellHelpers
describe('tests for update prototype with fragments on the server side', () => {
  test('basic prototype object with 2 fields and a fragment, should convert to a protoype with 2 fields and the fields from the fragment without the fragment key on the prototype object', () => {
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

    expect(updateProtoWithFragment(protoObj, fragment)).toEqual({

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
})

//*Legacy Test Suite for getMutationMap from quellHelpers
describe('server side tests for getMutationMap', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns valid mutations and their respective type based on schema', () => {
    expect(getMutationMap(schema)).toEqual({
      addBook: 'Book',
      changeBook: 'Book',
      addBookShelf: 'BookShelf',
      addCountry: 'Country', // Not found in testSchema?
      // deleteCity: 'City' // Not found in testSchema?
    });
  });
  test('Returns empty object for schema without mutations', () => {
    expect(getMutationMap(schemaWithoutMuts)).toEqual({});
  });
});

//*Legacy Test Suite for getQueryMap from quellHelpers
describe('server side tests for getQueryMap', () => {
  afterAll((done) => {
    done();
  });
  test('Correctly returns valid queries and their respective type based on schema', () => {
    expect(getQueryMap(schema)).toEqual({
      book: 'Book',
      bookShelf: 'BookShelf',
      bookShelves: ['BookShelf'],
      books: ['Book'],
      cities: ['City'],
      citiesByCountry: ['City'],
      city: 'City',
      countries: ['Country'],
      country: 'Country'
    });
  });
  test('Returns empty object for schema without queries', () => {
    expect(getQueryMap(schemaWithoutQueries)).toEqual({});
  });
});

//*Legacy Test Suite for getFieldsMap from quellHelpers
describe("server side tests for getFieldsMap", () => {
    afterAll((done) => {
      done();
    });
    test("Correctly returns valid fields and their respective type based on schema", () => {
      expect(getFieldsMap(schema)).toEqual({
        Book: {
          author: "String",
          id: "ID",
          name: "String",
          shelf_id: "String",
        },
        BookShelf: {
          books: "Book",
          id: "ID",
          name: "String",
        },
        City: {
          country_id: "String",
          id: "ID",
          name: "String",
          population: "Int",
        },
        Country: {
          capital: "String",
          cities: "City",
          id: "ID",
          name: "String",
        },
        RootMutationType: {
          addBook: "Book",
          addBookShelf: "BookShelf",
          addCountry: "Country",
          changeBook: "Book",
          //deleteCity field does not exist in testSchema, therefore commented out
          // deleteCity: "City",
        },
      });
    });
    test("Returns an empty object for any types in the schema without field values", () => {
      expect(getFieldsMap(schemaWithoutFields)).toEqual({
        Book: {},
        BookShelf: {},
        City: {},
        Country: {},
        RootMutationType: {},
      });
    });
  });
  