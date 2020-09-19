import createQueryObj from '../functions/createQueryObj';
import createQueryStr from '../functions/createQueryStr';
import joinResponses from '../functions/joinResponses';
import buildArray from '../functions/buildArray';
import normalizeForCache from '../functions/normalizeForCache';
// import sum from '../functions/sum';
// describe('sum', () => {
//   test('adds 4 + 6 to equal 10', () => {
//     expect(sum()).toBe(10);
//   });
// });





//   describe('createQueryObj', () => {
//     let prototype;

//     beforeEach(() => {
//       prototype = {
//         countries: {
//           id: true, 
//           name: true, 
//           capital: true, 
//           cities: {
//             country_id: true, 
//             id: true, 
//             name: true, 
//             population: true
//           },
//         }};
//     });

//     it('inputs prototype w/ all true and outputs empty object', () => {
//       expect(createQueryObj(prototype)).toEqual({});
//     });

//     it('inputs prototype w/ true/false for only scalar types and outputs object for false only', () => {
//       prototype.countries.id = false;
//       prototype.countries.name = false;
//       prototype.countries.capital = false;
//       expect(createQueryObj(prototype)).toEqual({ countries: [ 'id', 'name', 'capital' ] });
//     });
    
//     it('inputs prototype w/ true/false for only object types and outputs object for false only', () => {
//       prototype.countries.cities.country_id = false;
//       prototype.countries.cities.id = false;
//       prototype.countries.cities.name = false;
//       prototype.countries.cities.population = false;
//       expect(createQueryObj(prototype)).toEqual({ countries: [{ cities: ['country_id', 'id', 'name', 'population'] }] });
//     });
    
//     it('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
//       prototype.countries.id = false;
//       prototype.countries.name = false;
//       prototype.countries.cities.country_id = false;
//       prototype.countries.cities.population = false;
//       expect(createQueryObj(prototype)).toEqual({ countries: ['id', 'name', { cities: ['country_id', 'population'] }] });
//     });
//   });

//   describe('createQueryStr', () => {
//     const scalar = { countries: [ 'id', 'name', 'capital' ] };
//     it('inputs query object w/ only scalar types and outputs GCL query string', () => {
//       expect(createQueryStr(scalar)).toMatch( ' { countries { id name capital  }  } ' );
//     });
    
//     const object = { countries: [{ cities: ['country_id', 'id', 'name', 'population'] }] }
//     it('inputs query object w/ only object types and outputs GCL query string', () => {
//       expect(createQueryStr(object)).toMatch( ' { countries { cities { country_id id name population  }  }  } ' );
//     });
    
//     const both = { countries: ['id', 'name', { cities: ['country_id', 'population'] }] }
//     it('inputs query object w/ both scalar & object types and outputs GCL query string', () => {
//       expect(createQueryStr(both)).toMatch( ' { countries { id name cities { country_id population  }  }  } ' );
//     });
//   });
// });







describe('buildArray', () => {

  const sessionStorage = {
    storage: {},
    setItem: function(field, value) {
      this.storage[field] = value;
    },
    getItem: function(field) {
      return this.storage[field];
    }
  };
  
  sessionStorage.storage = {
    'Country': '["Country-1","Country-2","Country-3"]',
    'Country-1':	'{"id":"1","name":"Andorra","cities":["City-1","City-2"]}',
    'City-1':	'{"country_id":"1","id":"1"}',
    'City-2':	'{"country_id":"1","id":"2"}',
    'Country-2':	'{"id":"2","name":"Bolivia","cities":["City-3","City-4"]}',
    'City-3':	'{"country_id":"2","id":"3"}',
    'City-4':	'{"country_id":"2","id":"4"}',
    'Country-3':	'{"id":"3","name":"Armenia","cities":["City-5","City-6"]}',
    'City-5':	'{"country_id":"3","id":"5"}',
    'City-6':	'{"country_id":"3","id":"6"}',
  };

  // sessionStorage.getItem = jest.fn(function(field) {
  //   return this.storage[field];
  // });
  // console.log('sstest', sessionStorage.getItem)


  // let prototype;

  // beforeEach(() => {
  //   prototype = {
  //     artists: {
  //       id: true, 
  //       name: true, 
  //       instrument: true, 
  //       albums: {
  //         album_id: true, 
  //         id: true, 
  //         name: true, 
  //         release_year: true
  //       },
  //     }
  //   };
  // });

  const proto = {
    countries: {
      id: true, 
      name: true, 
      capital: true,
      cities: {
        country_id: true, 
        id: true, 
        name: true,
        population: true,
      },
    }
  };

  const map = {
    countries: 'Country',
    country: 'Country',
    citiesByCountryId: 'City',
    cities: 'City',
  };

  it('inputs prototype, map, and empty array and outputs empty array', () => {
    expect(buildArray(proto, map, [])).toEqual([]);
  });
  
  // it('inputs prototype, map, and cache hit and outputs array of cached objects', () => {
  //   const result1 = [ 
  //     { id: '1', name: 'Andorra', cities: [ 
  //       { country_id: '1', id: '1' }, { country_id: '1', id: '2' } 
  //     ] },
  //     { id: '2', name: 'Bolivia', cities: [ 
  //       { country_id: '2', id: '3' }, { country_id: '2', id: '4' } 
  //     ] },
  //     { id: '3', name: 'Armenia', cities: [ 
  //       { country_id: '3', id: '5' }, { country_id: '3', id: '6' } 
  //     ] } 
  //   ]; 
  //   expect(buildArray(proto, map)).toEqual(result1);
  // });
});

describe('createQueryObj', () => {
  let prototype;

  beforeEach(() => {
    prototype = {
      artists: {
        id: true, 
        name: true, 
        instrument: true, 
        albums: {
          album_id: true, 
          id: true, 
          name: true, 
          release_year: true
        },
      }
    };
  });

  it('inputs prototype w/ all true and outputs empty object', () => {
    expect(createQueryObj(prototype)).toEqual({});
  });

  it('inputs prototype w/ true/false for only scalar types and outputs object for false only', () => {
    prototype.artists.id = false;
    prototype.artists.name = false;
    prototype.artists.instrument = false;
    expect(createQueryObj(prototype)).toEqual({ artists: [ 'id', 'name', 'instrument' ] });
  });
  
  it('inputs prototype w/ true/false for only object types and outputs object for false only', () => {
    prototype.artists.albums.album_id = false;
    prototype.artists.albums.id = false;
    prototype.artists.albums.name = false;
    prototype.artists.albums.release_year = false;
    expect(createQueryObj(prototype)).toEqual({ artists: [{ albums: ['album_id', 'id', 'name', 'release_year'] }] });
  });
  
  it('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
    prototype.artists.id = false;
    prototype.artists.name = false;
    prototype.artists.albums.album_id = false;
    prototype.artists.albums.release_year = false;
    expect(createQueryObj(prototype)).toEqual({ artists: ['id', 'name', { albums: ['album_id', 'release_year'] }] });
  });
});

describe('createQueryStr', () => {
  it('inputs query object w/ only scalar types and outputs GCL query string', () => {
    const scalar = { artists: [ 'id', 'name', 'instrument' ] };
    expect(createQueryStr(scalar)).toMatch( ' { artists { id name instrument  }  } ' );
  });
  
  it('inputs query object w/ only object types and outputs GCL query string', () => {
    const object = { artists: [{ albums: ['album_id', 'id', 'name', 'release_year'] }] }
    expect(createQueryStr(object)).toMatch( ' { artists { albums { album_id id name release_year  }  }  } ' );
  });
  
  it('inputs query object w/ both scalar & object types and outputs GCL query string', () => {
    const both = { artists: ['id', 'name', { albums: ['album_id', 'release_year'] }] }
    expect(createQueryStr(both)).toMatch( ' { artists { id name albums { album_id release_year  }  }  } ' );
  });
});

describe('joinResponses', () => {
  it('inputs two arrays (scalar <<< scalar) and outputs combined array', () => {
    const scalar1 = [
      {id: "1", name: "John Coltrane"}, 
      {id: "2", name: "Miles Davis"},
      {id: "3", name: "Thelonious Monk"},
    ];
    const scalar1_2 = [
      {instrument: "saxophone"},
      {instrument: "trumpet"},
      {instrument: "piano"},
    ];
    expect(joinResponses(scalar1, scalar1_2)).toEqual([
      { id: '1', name: 'John Coltrane', instrument: 'saxophone' },
      { id: '2', name: 'Miles Davis', instrument: 'trumpet' },
      { id: '3', name: 'Thelonious Monk', instrument: 'piano' }
    ]);
  });

  it('inputs two arrays (non-scalar <<< scalar) and outputs combined array', () => {
    const nonScalar2 = [
      {albums:[
        {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
        {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
      ], instrument: "saxophone"},
      {albums:[
        {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
        {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
      ], instrument: "trumpet"},
      {albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
        {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
      ], instrument: "piano"},
    ];

    const scalar2 = [
      {id: "1", name: "John Coltrane"}, 
      {id: "2", name: "Miles Davis"},
      {id: "3", name: "Thelonious Monk"},
    ];

    const result2 = [
      {albums:[
        {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
        {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
      ], instrument: "saxophone", id: "1", name: "John Coltrane"},
      {albums:[
        {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
        {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
      ], instrument: "trumpet", id: "2", name: "Miles Davis"},
      {albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
        {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
      ], instrument: "piano", id: "3", name: "Thelonious Monk"},
    ];

    expect(joinResponses(nonScalar2, scalar2)).toEqual(result2);
  });

  it('inputs two arrays (scalar <<< non-scalar) and outputs combined array', () => {
    const scalar3 = [
      {id: "1", name: "John Coltrane"}, 
      {id: "2", name: "Miles Davis"},
      {id: "3", name: "Thelonious Monk"},
    ];
  
    const nonScalar3 = [
      {albums:[
        {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
        {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
      ], instrument: "saxophone"},
      {albums:[
        {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
        {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
      ], instrument: "trumpet"},
      {albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
        {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
      ], instrument: "piano"},
    ];
  
    const result3 = [
      {id: "1", name: "John Coltrane", albums:[
        {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
        {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
      ], instrument: "saxophone"},
      {id: "2", name: "Miles Davis", albums:[
        {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
        {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
      ], instrument: "trumpet"},
      {id: "3", name: "Thelonious Monk", albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
        {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
      ], instrument: "piano"},
    ];

    expect(joinResponses(scalar3, nonScalar3)).toEqual(result3);
  });
  
  it('inputs two arrays (non-scalar <<< non-scalar) and outputs combined array', () => {
    const nonScalar4 = [
      {id: "1", name: "John Coltrane", albums:[
        {album_id:"1", id:"101", name: "Blue Train"},
        {album_id:"2", id:"201", name: "Giant Steps"},
      ]},
      {id: "2", name: "Miles Davis", albums:[
        {album_id:"3", id:"301", name: "Kind of Blue"},
        {album_id:"4", id:"401", name: "In a Silent Way"},
      ]},
      {id: "3", name: "Thelonious Monk", albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners"},
        {album_id:"6", id:"601", name: "Monks Dream"},
      ]},
    ];
  
    const nonScalar5 = [
      {albums:[
        {release_year: 1957},
        {release_year: 1965},
      ], instrument: "saxophone"},
      {albums:[
        {release_year: 1959},
        {release_year: 1969},
      ], instrument: "trumpet"},
      {albums:[
        {release_year: 1957},
        {release_year: 1963},
      ], instrument: "piano"},
    ];
  
    const result4 = [
      {id: "1", name: "John Coltrane", albums:[
        {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
        {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
      ], instrument: "saxophone"},
      {id: "2", name: "Miles Davis", albums:[
        {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
        {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
      ], instrument: "trumpet"},
      {id: "3", name: "Thelonious Monk", albums:[
        {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
        {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
      ], instrument: "piano"},
    ];

    expect(joinResponses(nonScalar4, nonScalar5)).toEqual(result4);
  });
});

// describe('normalizeForCache', () => {
//   it('inputs response-data, map, fields-map and outputs ', () => {

//   });
// });    
