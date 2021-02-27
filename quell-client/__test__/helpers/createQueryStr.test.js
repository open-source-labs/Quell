const createQueryStr = require('../../helpers/createQueryStr');

const queryObject1 = {
  countries: ['name', 'capital'],
};

const queryObject2 = {
  countries: [
    'name',
    'capital',
    { cities: ['id', 'country_id', 'name', 'population'] },
  ],
};

const queryObject3 = {
  country: [
    'name',
    'capital',
    { cities: ['id', 'country_id', 'name', 'population'] },
  ],
};

const QuellStore1 = { arguments: null, alias: null };

const QuellStore2 = { arguments: { country: [{ id: '1' }] }, alias: null };

const QuellStore3 = {
  arguments: { country: [{ name: 'China' }, { capital: 'Beijing' }] },
  alias: null,
};

describe('createQueryStr', () => {
  test('should convert a query object into a formal GCL query string', () => {
    expect(createQueryStr(queryObject1, QuellStore1)).toEqual(
      `{countries  { name capital   }}`
    );
  });

  test('should convert a nested query object into a formal GCL query string', () => {
    expect(createQueryStr(queryObject2, QuellStore1)).toEqual(
      `{countries  { name capital cities  { id country_id name population  }  }}`
    );
  });

  test('should be able to conver a query with an argument', () => {
    expect(createQueryStr(queryObject3, QuellStore2)).toEqual(
      `{country ( id : 1  ) { name capital cities  { id country_id name population  }  }}`
    );
  });

  test('should be able to conver a query with multiple arguments', () => {
    expect(createQueryStr(queryObject3, QuellStore3)).toEqual(
      `{country ( name : China , capital : Beijing  ) { name capital cities  { id country_id name population  }  }}`
    );
  });
});
