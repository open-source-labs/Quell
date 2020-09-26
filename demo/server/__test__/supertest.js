const request = require('supertest');
const app = require('../server');

describe('/graphql', () => {
  describe('POST', () => {

    it('responds with 200 status on valid request', () => {
      return request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({ "query": "{countries{id name capital}}" })
        .expect(200)
    });

    it('responds with 400 status on invalid request', () => {
      return request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send("Invalid query")
        .expect(400)
    });

  });
});
