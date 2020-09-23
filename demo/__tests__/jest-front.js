const createQueryObj = require('../../quell-client/createQueryObj');
const createQueryStr = require('../../quell-client/createQueryStr');
const joinResponses = require('../../quell-client/joinResponses');

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
  const protoObj = {
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

  const protoObjShort = {
    artists: {
      id: true, 
      name: true, 
      instrument: true,
    }
  };

  const result = [
    {id: "1", name: "John Coltrane", instrument: "saxophone", albums:[
      {album_id:"1", id:"101", name: "Blue Train", release_year: 1957},
      {album_id:"2", id:"201", name: "Giant Steps", release_year: 1965},
    ]},
    {id: "2", name: "Miles Davis", instrument: "trumpet", albums:[
      {album_id:"3", id:"301", name: "Kind of Blue", release_year: 1959},
      {album_id:"4", id:"401", name: "In a Silent Way", release_year: 1969},
    ]},
    {id: "3", name: "Thelonious Monk", instrument: "piano", albums:[
      {album_id:"5", id:"501", name: "Brilliant Corners", release_year: 1957},
      {album_id:"6", id:"601", name: "Monks Dream", release_year: 1963},
    ]},
  ];

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
    
    expect(joinResponses(scalar1, scalar1_2, protoObjShort)).toEqual([
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

    expect(joinResponses(nonScalar2, scalar2, protoObj)).toEqual(result);
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
  
    expect(joinResponses(scalar3, nonScalar3, protoObj)).toEqual(result);
  });
  
  it('inputs two arrays (non-scalar <<< non-scalar) and outputs combined array', () => {
    const nonScalar4 = [
      {id: "1", name: "John Coltrane", albums:[
        {album_id:"1", id:"101", release_year: 1957},
        {album_id:"2", id:"201", release_year: 1965},
      ]},
      {id: "2", name: "Miles Davis", albums:[
        {album_id:"3", id:"301", release_year: 1959},
        {album_id:"4", id:"401", release_year: 1969},
      ]},
      {id: "3", name: "Thelonious Monk", albums:[
        {album_id:"5", id:"501", release_year: 1957},
        {album_id:"6", id:"601", release_year: 1963},
      ]},
    ];
  
    const nonScalar5 = [
      {albums:[
        {name: "Blue Train"},
        {name: "Giant Steps"},
      ], instrument: "saxophone"},
      {albums:[
        {name: "Kind of Blue"},
        {name: "In a Silent Way"},
      ], instrument: "trumpet"},
      {albums:[
        {name: "Brilliant Corners"},
        {name: "Monks Dream"},
      ], instrument: "piano"},
    ];
    
    expect(joinResponses(nonScalar4, nonScalar5, protoObj)).toEqual(result);
  });
});
