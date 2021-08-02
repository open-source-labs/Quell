const request = require('supertest');
const redis = require('redis');

const server = 'http://localhost:4000';

const redisClient = redis.createClient({
  host: '127.0.0.1',
  port: 6379, // default redis port
});

describe('Server Cache Invalidation Tests', () => {
  const books = {
    name: 'Jinhee',
    author: 'Choi',
    shelf_id: '1',
  };

  const changedBooks = {
    id: '18',
    name: 'Jinhee',
    author: 'Choi',
    // shelf_id: '1',
  };

  // add mutation adds to database
  // update mutation updates database
  // delete mutation deletes entry from database

  // add mutation adds to redis server cache
  // ---> add to database, get id from response, and check if e.g. book--${id} in server cache, and args == book--${id}.value

  // update mutation updates entry in server cache
  // ---> update database entry, get id from response,
  // ---> check if e.g. book--${id} in server cache, and args == book--${id}.value

  it.skip('update book ', async() => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `
          mutation {changeBook(id: "14", author: "Frenzel") {id name author}}
        `,
      })
      .then((response) => {
        expect(JSON.parse(response.text)).toEqual(changedBooks);
      });
  });

  it.skip('delete book ', async() => {
    return request(server)
      .delete('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `
          mutation {deleteBook(id: "27", name: "Jinhee") {id name author}}
        `,
      })
      .then((response) => {
        expect(JSON.parse(response.text)).toEqual({});
      });
  });

  // delete mutation deletes entry in redis server cache
  // ---> delete database entry, get id from response
  // ---> make sure book--${id} does not exist in server cache

  it('add book ', async () => {
    return request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        // query: `{addBook(name: "whatever", author: "whoever", shelf_id: "1"){id name author}}`,
        query: `
        mutation {addBook(name: "Jinhee", author: "Choi", shelf_id: "1") {id name author shelf_id}}
        `,
        // query: `{books{id name author}}`,
      })
      .then((response) => {
        expect(JSON.parse(response.text)).toEqual(books);
      });
  });

  it('test redis', async () => {
    redisClient.get('country--1', (err, reply) => {
      if (err) throw err;

      expect(JSON.parse(reply)).toEqual({ id: '1', name: 'Andorra' });
    });
    // redisClient.get('country--1').then((response) => {
    //   expect(response.text).toEqual('shit');
    // });
  });

  it('clears cache', async () => {
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
