const QuellCache = require('../../src/quell');
const testSchema = require('../../test-config/testSchema');
const schema = require('../../test-config/testSchema');

const redisPort = 6379;
const timeout = 100;


describe('tests for update prototype with fragments on the server side', () => {
  const Quell = new QuellCache(schema, redisPort, timeout);


  afterAll((done) => {
    Quell.redisCache.flushall();
    Quell.redisCache.quit(() => {
      console.log('closing redis server');
      done();
    });
  });
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

    expect(Quell.updateProtoWithFragment(protoObj, fragment)).toEqual({
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