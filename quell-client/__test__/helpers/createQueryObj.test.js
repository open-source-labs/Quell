const createQueryObj = require('../../src/helpers/createQueryObj');

describe('createQueryObj.js', () => {
  test('inputs prototype w/ all true should output empty object', () => {
    const map = {
      countries: {
        id: true,
        name: true,
        capitol: true,
        __alias: null,
        __args: {},
        cities: {
          id: true,
          country_id: true,
          name: true,
          population: true,
          __alias: null,
          __args: {}
        },
      },
    };

    expect(createQueryObj(map)).toEqual({});
  });

  test('inputs prototype w/ only false scalar types should output same object', () => {
    const map = {
      countries: {
        id: false,
        name: false,
        capitol: false,
        __alias: null,
        __args: {}
      }
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        id: false,
        name: false,
        capitol: false,
        __alias: null,
        __args: {}
      },
    });
  });

  test('inputs prototype w/ false for only scalar types should output object for scalar types only', () => {
    const map = {
      countries: {
        id: false,
        name: false,
        capitol: false,
        __alias: null,
        __args: {},
        cities: {
          id: true,
          country_id: true,
          name: true,
          population: true,
          __alias: null,
          __args: {}
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        id: false,
        name: false,
        capitol: false,
        __alias: null,
        __args: {},
      },
    });
  });

  test('inputs prototype w/ false for only object types should output object for object types only', () => {
    const map = {
      countries: {
        id: true,
        name: true,
        capital: true,
        __alias: null,
        __args: {},
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false,
          __alias: null,
          __args: {},
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        __alias: null,
        __args: {},
        cities: {
          id: false,
          country_id: false,
          name: false,
          population: false,
          __alias: null,
          __args: {},
        },
      },
    });
  });

  test('inputs prototype w/ true/false for both scalar & object types and outputs object for all false', () => {
    const map = {
      countries: {
        id: true,
        name: false,
        capital: false,
        __alias: null,
        __args: {},
        cities: {
          id: true,
          country_id: false,
          name: true,
          population: false,
          __alias: null,
          __args: {},
        },
      },
    };

    expect(createQueryObj(map)).toEqual({
      countries: {
        name: false,
        capital: false,
        __alias: null,
        __args: {},
        cities: {
          country_id: false,
          population: false,
          __alias: null,
          __args: {},
        },
      },
    });
  });

  test('inputs prototype with multiple queries', () => {
    const map = {
      'country--1': {
        id: true,
        name: false,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: false,
          name: true,
          population: false,
          __alias: null,
          __args: {}
        }
      },
      'country--2': {
        id: true,
        name: false,
        __alias: 'Mexico',
        __args: { id: '2' },
        climate: {
          seasons: true,
          __alias: null,
          __args: {}
        }
      }
    };

    expect(createQueryObj(map)).toEqual({
      'country--1': {
        name: false,
        __alias: 'Canada',
        __args: { id: '1' },
        capitol: {
          id: false,
          population: false,
          __alias: null,
          __args: {}
        }
      },
      'country--2': {
        name: false,
        __alias: 'Mexico',
        __args: { id: '2' },
      }
    });
  })
});
