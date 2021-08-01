const request = require('supertest');
const redis = require('redis');

const server = 'http://localhost:3000';

describe('Server Cache Invalidation Tests', () => {
  const redisClient = redis.createClient(6379);
  const books = {
    id: '14',
    name: 'whatever',
    author: 'whoever',
    shelf_id: '1',
  };

  // add mutation adds to redis server cache
  // ---> add to database, get id from response, and check if e.g. book--${id} in server cache, and args == book--${id}.value

  // update mutation updates entry in server cache
  // ---> update database entry, get id from response,
  // ---> check if e.g. book--${id} in server cache, and args == book--${id}.value

  // delete mutation deletes entry in redis server cache
  // ---> delete database entry, get id from response
  // ---> make sure book--${id} does not exist in server cache

  // create a mutation that deletes everything from books table

  afterAll((done) => {
    redisClient.flushall();
    redisClient.quit(() => {
      console.log('closing redis server');
      done();
    });
  });

  test('Check if add mutation, adds cache entry to redis server cache', (done) => {
    return (
      request(server)
        .post('/graphql')
        .set('Accept', 'application/json')
        .send({
          query: `
        mutation {addBook(name: "Why We Sleep", author: "Matthew Walker", shelf_id: "1") {id name author shelf_id}}
        `,
        })
        // expect status 200, (ensure mutation was successful)
        .expect(200)
        .then((response) => {
          let responseJson = JSON.parse(response.text);
          //   await expect(responseJson).resolves.toHaveProperty('data');
          expect(responseJson.data).toHaveProperty('addBook');
          expect(responseJson.data.addBook).toHaveProperty('id');

          let responseId = responseJson.data.addBook.id;
          //   expect(responseId).to

          //   console.log('DB RESPONSE ID : ', responseId);
          redisClient.get(`book--${48}`, (err, reply) => {
            // if (err) throw err;
            expect(err).toBeFalsy();
            let redisKeyValue = JSON.parse(reply);
            catchErrors(done, (err, res) => {
              throw 'Catched by catchErrors so that our tests properly fail!';
              done();
            });

            expect(redisKeyValue).resolves.not.toEqual(null);
            console.log('REDIS ERR:  ', err);
            console.log('REDIS KEY VALUE : ', redisKeyValue);
            console.log('DB RESPONSE ID: ', responseId);

            // check if newly added redis key value, has properties we added as args in our mutation
            expect(redisKeyValue).toHaveProperty('name');

            expect(redisKeyValue.name).toEqual('Why We Sleep');
            expect(redisKeyValue.author).toEqual('Matthew Walker');
            expect(redisKeyValue.shelf_id).toEqual('1');
          });
        })
        .catch((err) => {
          console.log(`ERRORRRR: ${err}`);
        })
    );
  });

  it.skip('add book ', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        // query: `{addBook(name: "whatever", author: "whoever", shelf_id: "1"){id name author}}`,
        query: `
        mutation {addBook(name: "Jinhee", author: "Choi", shelf_id: "1") {name author shelf_id}}
        `,
        // query: `{books{id name author}}`,
      })
      .then((response) => {
        expect(JSON.parse(response.text)).toEqual(books);
      });
  });

  it.skip('test redis', async () => {
    redisClient.get('country--1', (err, reply) => {
      if (err) throw err;

      expect(JSON.parse(reply)).toEqual({ id: '1', name: 'Andorra' });
    });
    // redisClient.get('country--1').then((response) => {
    //   expect(response.text).toEqual('shit');
    // });
  });

  it.skip('clears cache', async () => {
    return request(server)
      .get('/clearCache')
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual('Redis cache successfully cleared');
      });
  });

  it.skip('returns correct data when cache is empty || {countries{id name}}', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query: '{countries{id name}}' })
      .expect(200)
      .then((response) => {
        // if (err) return done(err);
        expect(response.body.data).toEqual(countries);
      });
  });

  it.skip('combines data for multiple queries from cache and database || {countries{id name} cities {id name}}', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query: '{countries{id name} cities {id name}}' })
      .expect(200)
      .then((response) => {
        // if (err) return done(err);
        expect(response.body.data).toEqual(countriesAndCities);
      });
  });

  it.skip('combines data for one query from cache and database || {country (id: 1) {id name capital}}', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query: '{country (id: 1) {id name capital}}' })
      .expect(200)
      .then((response) => {
        // if (err) return done(err);
        expect(response.body.data).toEqual(countryId);
      });
  });

  it.skip('combines data for one nested query from cache and database || {country (id: 1) {id name cities {id name population}}}', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: '{country (id: 1) {id name cities {id name population}}}',
      })
      .expect(200)
      .then((response) => {
        // if (err) return done(err);
        expect(response.body.data).toEqual(countryIdWithCities);
      });
  });
});
