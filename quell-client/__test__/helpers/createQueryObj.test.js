const createQueryObj = require('../../helpers/createQueryObj');

const map1 = { countries: { id: true, name: false, capital: false } };
const map2 = {
  countries: {
    id: true,
    name: false,
    capital: false,
    cities: { id: false, country_id: false, name: false, population: false },
  },
}

describe('createQueryObj.js', () => {
  test('should takes in a map of field(keys) and true/false(values) and creates a query object containing the fields (false) missing from cache', () => {
    expect(createQueryObj(map1)).toEqual({ countries: ['name', 'capital'] });
  });

  test('should work with nested map', () => {
    expect(createQueryObj(map2)).toEqual({
      countries: [
        'name',
        'capital',
        { cities: ['id', 'country_id', 'name', 'population'] },
      ],
    });
  });
});
