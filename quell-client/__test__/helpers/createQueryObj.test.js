const createQueryObj = require('../../src/helpers/createQueryObj');

describe('createQueryObj.js', () => {
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
      }
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
        __id: null,
        __alias: null,
        __args: {},
        __type: 'countries',
        id: false,
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
        }
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
          id: true,
          seasons: true,
        }
      }
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
        }
      },
      Mexico: {
        name: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        __type: 'country',
        __id: '2',
        id: false,
      }
    });
  })
});
