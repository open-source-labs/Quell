const createQueryObj = require('../../src/helpers/createQueryObj');

describe('createQueryObj.js', () => {
  test('inputs prototype w/ all true should output empty object', () => {
    const map = {
      countries: {
        id: true,
        name: true,
        capital: true,
        cities: {
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({});
  });

  test('inputs prototype w/ false for only object types should output object for false only', () => {
    const map = { countries: { id: false, name: false, capital: false } };

    expect(createQueryObj(map)).toEqual({
      countries: ['id', 'name', 'capital'],
    });
  });

  test('inputs prototype w/ false for only scalar types should output object for scalar types only', () => {
    const map = {
      countries: {
        id: false,
        name: false,
        capital: false,
        cities: {
          id: true,
          country_id: true,
          name: true,
          population: true,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: ['id', 'name', 'capital'],
    });
  });

  test('inputs prototype w/ false for only object types should output object for object types only', () => {
    const map = {
      countries: {
        id: true,
        name: true,
        capital: true,
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: [{ cities: ['id', 'country_id', 'name', 'population'] }],
    });
  });

  test('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
    const map = {
      countries: {
        id: true,
        name: false,
        capital: false,
        cities: {
          id: true,
          country_id: false,
          name: true,
          population: false,
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: ['name', 'capital', { cities: ['country_id', 'population'] }],
    });
  });
});
