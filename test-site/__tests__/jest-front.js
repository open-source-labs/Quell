import sum from '../functions/sum';
import createQueryObj from '../functions/createQueryObj';
import createQueryStr from '../functions/createQueryStr';

describe('Query Construct', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });

  // const map = { 
  //   countries: 'Country',
  //   country: 'Country',
  //   citiesByCountryId: 'City',
  //   cities: 'City'
  // };
  
  // const fieldsMap = { cities: 'City' };

  // // prototype, map, collection
  // describe('buildArray', () => {
  //   expect(buildArray(
  //     arg1,
  //     arg2,
  //     arg3)).toEqual
  // });

  describe('createQueryObj', () => {
    let prototype;

    beforeEach(() => {
      prototype = {
        countries: {
          id: true, 
          name: true, 
          capital: true, 
          cities: {
            country_id: true, 
            id: true, 
            name: true, 
            population: true
          },
        }};
    });

    it('inputs prototype w/ all true and outputs empty object', () => {
      expect(createQueryObj(prototype)).toEqual({});
    });

    it('inputs prototype w/ true/false for only scalar types and outputs object for false only', () => {
      prototype.countries.id = false;
      prototype.countries.name = false;
      prototype.countries.capital = false;
      expect(createQueryObj(prototype)).toEqual({ countries: [ 'id', 'name', 'capital' ] });
    });
    
    it('inputs prototype w/ true/false for only object types and outputs object for false only', () => {
      prototype.countries.cities.country_id = false;
      prototype.countries.cities.id = false;
      prototype.countries.cities.name = false;
      prototype.countries.cities.population = false;
      expect(createQueryObj(prototype)).toEqual({ countries: [{ cities: ['country_id', 'id', 'name', 'population'] }] });
    });
    
    it('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
      prototype.countries.id = false;
      prototype.countries.name = false;
      prototype.countries.cities.country_id = false;
      prototype.countries.cities.population = false;
      expect(createQueryObj(prototype)).toEqual({ countries: ['id', 'name', { cities: ['country_id', 'population'] }] });
    });
  });

  describe('createQueryStr', () => {
    const scalar = { countries: [ 'id', 'name', 'capital' ] };
    it('inputs query object w/ only scalar types and outputs GCL query string', () => {
      expect(createQueryStr(scalar)).toMatch( ' { countries { id name capital  }  } ' );
    });
    
    const object = { countries: [{ cities: ['country_id', 'id', 'name', 'population'] }] }
    it('inputs query object w/ only object types and outputs GCL query string', () => {
      expect(createQueryStr(object)).toMatch( ' { countries { cities { country_id id name population  }  }  } ' );
    });
    
    const both = { countries: ['id', 'name', { cities: ['country_id', 'population'] }] }
    it('inputs query object w/ both scalar & object types and outputs GCL query string', () => {
      expect(createQueryStr(both)).toMatch( ' { countries { id name cities { country_id population  }  }  } ' );
    });
  });
});