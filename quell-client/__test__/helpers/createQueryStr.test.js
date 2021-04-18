const createQueryStr = require('../../src/helpers/createQueryStr');

describe('createQueryStr.js', () => {
  test('inputs query object w/ only scalar types and outputs GCL query string', () => {
    const queryObject = {
      countries: ['id', 'name', 'capital'],
    };
    const QuellStore = { arguments: null, alias: null };

    expect(createQueryStr(queryObject, QuellStore)).toEqual(
      `{countries  { id name capital   }}`
    );
  });

  test('inputs query object w/ only object types and outputs GCL query string', () => {
    const queryObject = {
      countries: [{ cities: ['id', 'country_id', 'name', 'population'] }],
    };
    const QuellStore = { arguments: null, alias: null };

    expect(createQueryStr(queryObject, QuellStore)).toEqual(
      `{countries  { cities  { id country_id name population  }  }}`
    );
  });

  test('inputs query object w/ both scalar & object types and outputs GCL query string', () => {
    const queryObject = {
      countries: [
        'id',
        'name',
        'capital',
        { cities: ['id', 'country_id', 'name', 'population'] },
      ],
    };
    const QuellStore = { arguments: null, alias: null };

    expect(createQueryStr(queryObject, QuellStore)).toEqual(
      `{countries  { id name capital cities  { id country_id name population  }  }}`
    );
  });

  test('inputs query object w/ an argument & w/ both scalar & object types should output GCL query string', () => {
    const queryObject = {
      country: [
        'id',
        'name',
        'capital',
        { cities: ['id', 'country_id', 'name', 'population'] },
      ],
    };
    const QuellStore = { arguments: { country: [{ id: '1' }] }, alias: null };

    expect(createQueryStr(queryObject, QuellStore)).toEqual(
      `{country ( id : 1  ) { id name capital cities  { id country_id name population  }  }}`
    );
  });

  test('inputs query object w/ multiple arguments & w/ both scalar & object types should output GCL query string', () => {
    const queryObject = {
      country: [
        'id',
        'name',
        'capital',
        { cities: ['id', 'country_id', 'name', 'population'] },
      ],
    };
    const QuellStore = {
      arguments: { country: [{ name: 'China' }, { capital: 'Beijing' }] },
      alias: null,
    };

    expect(createQueryStr(queryObject, QuellStore)).toEqual(
      `{country ( name : China , capital : Beijing  ) { id name capital cities  { id country_id name population  }  }}`
    );
  });
});
