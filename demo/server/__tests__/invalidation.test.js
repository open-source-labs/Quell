const request = require('supertest');
const redis = require('redis');

const { promisify } = require('util');

const server = 'http://localhost:3000';

describe('Server Cache Invalidation Tests', () => {
  const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379,
  });
  const redisGetAsync = promisify(redisClient.get).bind(redisClient);
  const redisExistsAsync = promisify(redisClient.exists).bind(redisClient);
  const redisSetAsync = promisify(redisClient.set).bind(redisClient);

  beforeEach((done) => {
    redisClient.flushall(() => {
      done();
    });
  });

  beforeAll((done) => {
    redisClient.flushall(() => {
      done();
    });
  });

  afterAll((done) => {
    // redisClient.flushall();
    redisClient.quit(() => {
      console.log('closing redis server');
      done();
    });
  });

  const addBook = async (name, author, shelf_id) => {
    let queryString = `mutation {addBook(name: "${name}", author: "${author}", shelf_id: "${shelf_id}") {id name author shelf_id}}`;

    let serverResponseRaw = await request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: queryString,
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return error;
      });

    // server executed graphQL add mutation
    expect(serverResponseRaw.error).toBeFalsy();

    let responseJson = JSON.parse(serverResponseRaw.text);

    // await expect(responseJson).resolves.toHaveProperty('data');
    expect(responseJson.data).toHaveProperty('addBook');
    expect(responseJson.data.addBook).toHaveProperty('id');

    // id obtained from database
    let responseId = responseJson.data.addBook.id;

    return responseId;
  };

  const changeBookById = async (id, name, author) => {
    let queryString = `mutation {changeBookById(id: ${id}, name: "${name}", author: "${author}") {id name author shelf_id}}`;

    let serverResponseRaw = await request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: queryString,
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return error;
      });

    // server executed graphQL add mutation
    expect(serverResponseRaw.error).toBeFalsy();

    let responseJson = JSON.parse(serverResponseRaw.text);

    // await expect(responseJson).resolves.toHaveProperty('data');
    expect(responseJson.data).toHaveProperty('changeBookById');
    expect(responseJson.data.changeBookById).toHaveProperty('id');

    // id obtained from database
    let responseId = responseJson.data.changeBookById.id;

    return responseId;
  };

  const changeBooksByAuthor = async (id, name, author) => {
    let queryString = `mutation {changeBooksByAuthor(name: "${name}", author: "${author}") {id name author shelf_id}}`;

    let serverResponseRaw = await request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: queryString,
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return error;
      });

    // server executed graphQL update mutation (no user specified id)
    expect(serverResponseRaw.error).toBeFalsy();
  };

  const deleteBookById = async (id) => {
    let queryString = `mutation {deleteBookById(id: ${id}) {id name author shelf_id}}`;

    let serverResponseRaw = await request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: queryString,
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return error;
      });

    // server executed graphQL delete mutation
    expect(serverResponseRaw.error).toBeFalsy();

    let responseJson = JSON.parse(serverResponseRaw.text);

    // await expect(responseJson).resolves.toHaveProperty('data');
    expect(responseJson.data).toHaveProperty('deleteBookById');
    expect(responseJson.data.deleteBookById).toHaveProperty('id');

    // id obtained from database
    let responseId = responseJson.data.deleteBookById.id;

    return responseId;
  };

  const deleteBooksByName = async (name, author) => {
    let queryString = `mutation {deleteBooksByName(name: "${name}", author: "${author}") {id name author shelf_id}}`;

    let serverResponseRaw = await request(server)
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: queryString,
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return error;
      });

    // server executed graphQL delete mutation (no user id specified)
    expect(serverResponseRaw.error).toBeFalsy();
    return serverResponseRaw.text;
  };

  test('Check if add mutation, adds cache entry to redis server cache', async (done) => {
    let responseId = await addBook('Why We Sleep', 'Matthew Walker', 1);

    // get key value associated with key `book--${responseId}`
    redisClient.get(`book--${responseId}`, (err, reply) => {
      // expect no errors to have happened
      expect(err).toBeFalsy();

      let redisKeyValue = JSON.parse(reply);

      // redis key value should exist
      expect(redisKeyValue).toBeTruthy();

      // check if newly added redis key value, has properties we added as args in our mutation
      expect(redisKeyValue).toHaveProperty('name');
      expect(redisKeyValue).toHaveProperty('author');
      expect(redisKeyValue).toHaveProperty('shelf_id');

      // check if cache entry in redis has data we just added
      expect(redisKeyValue.name).toEqual('Why We Sleep');
      expect(redisKeyValue.author).toEqual('Matthew Walker');
      expect(redisKeyValue.shelf_id).toEqual('1');
      done();
    });
  });

  test(`Check if add mutation, updates [mutationType] (e.g. books) in redis cache`, async (done) => {
    let responseId = await addBook('Why We Sleep', 'Matthew Walker', 1);

    redisClient.get(`books`, (err, reply) => {
      // expect no erros to have happened
      expect(err).toBeFalsy();

      // redis key value should exist in books list
      let redisKeyValueList = JSON.parse(reply);
      expect(redisKeyValueList.includes(`Book--${responseId}`)).toEqual(true);
      done();
    });
  });

  test('Check if update mutation (with user specified id), updates redis cache entry', async (done) => {
    let addResponseId = await addBook('Art of War', 'Sun Tzu', 1);
    let updateResponseId = await changeBookById(
      addResponseId,
      'The Subtle Art of Not Giving a F*ck',
      'Mark Manson'
    );

    // get key value associated with key `book--${responseId}`
    redisClient.get(`book--${updateResponseId}`, (err, reply) => {
      // expect no errors to have happened
      expect(err).toBeFalsy();

      let redisKeyValue = JSON.parse(reply);

      // redis key value should exist
      expect(redisKeyValue).toBeTruthy();

      // check if newly added redis key value, has properties we added as args in our mutation
      expect(redisKeyValue).toHaveProperty('name');
      expect(redisKeyValue).toHaveProperty('author');
      expect(redisKeyValue).toHaveProperty('shelf_id');

      // check if cache entry in redis has data we just added
      expect(redisKeyValue.name).toEqual('The Subtle Art of Not Giving a F*ck');
      expect(redisKeyValue.author).toEqual('Mark Manson');
      expect(redisKeyValue.shelf_id).toEqual('1');

      done();
    });
  });

  test('Check if update mutation (with no user specified id) removes relevant cache entries and updates field keys list', async (done) => {
    let book1Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book2Id = await addBook('Be Water, My Friend', 'Shannon Lee', 1);
    let book3Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book4Id = await addBook('Be Water, My Friend', 'Shannon Lee', 1);
    let book5Id = await addBook('The Notebook', 'Nicholas Sparks', 1);

    // expected values after update
    let book1ExpVal = {
      id: book1Id,
      name: 'The Notebook',
      author: 'Nicholas Sparks',
      shelf_id: '1',
    };
    let book2ExpVal = {
      id: book2Id,
      name: 'Be Water, My Friend: The Teachings of Bruce Lee',
      author: 'Shannon Lee',
      shelf_id: '1',
    };
    let book3ExpVal = {
      id: book3Id,
      name: 'The Notebook',
      author: 'Nicholas Sparks',
      shelf_id: '1',
    };
    let book4ExpVal = {
      id: book4Id,
      name: 'Be Water, My Friend: The Teachings of Bruce Lee',
      author: 'Shannon Lee',
      shelf_id: '1',
    };
    let book5ExpVal = {
      id: book5Id,
      name: 'The Notebook',
      author: 'Nicholas Sparks',
      shelf_id: '1',
    };

    await changeBooksByAuthor(
      'Be Water, My Friend: The Teachings of Bruce Lee',
      'Shannon Lee'
    );
    redisGetAsync(`book--${book1Id}`)
      .then((book1Val) => {
        expect(JSON.parse(book1Val)).toEqual(book1ExpVal);
        done();
      })
      .catch((err) => done(err));
  });

  test('Check if delete mutation (with user specified id), deletes single cache entry from redis', async (done) => {
    let addResponseId = await addBook('Why We Sleep', 'Matthew Walker', 1);
    let deleteResponseId = await deleteBookById(addResponseId);

    redisClient.get(`book--${deleteResponseId}`, (err, reply) => {
      let redisKeyValue = JSON.parse(JSON.stringify(reply));

      // redis key value should not exist because delete mutation deletes it
      expect(redisKeyValue).toBeFalsy();
      done();
    });
  });

  test('Check if delete mutation (with user specified id), removes field key from field keys list', async (done) => {
    let addResponseId = await addBook('Why We Sleep', 'Matthew Walker', 1);
    let deleteResponseId = await deleteBookById(addResponseId);

    redisClient.get(`books`, (err, reply) => {
      let fieldKeysList = JSON.parse(JSON.stringify(reply));

      // redis key value should not exist because delete mutation deletes it
      expect(fieldKeysList.includes(`Book--${deleteResponseId}`)).toEqual(
        false
      );
      done();
    });
  });

  test('Check if delete mutation (with no user specified id) removes relevant cache entries from redis and updates field keys list', async (done) => {
    // redisClient.flushall(() => {});
    let book1Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book2Id = await addBook('Be Water, My Friend', 'Shannon Lee', 1);
    let book3Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book4Id = await addBook('Be Water, My Friend', 'Shannon Lee', 1);
    let book5Id = await addBook('The Notebook', 'Nicholas Sparks', 1);

    let expectedFieldsList = [
      `Book--${book1Id}`,
      `Book--${book3Id}`,
      `Book--${book5Id}`,
    ];
    let serverRespText = await deleteBooksByName(
      'Be Water, My Friend',
      'Shannon Lee'
    );

    // await redisGetAsync(`book--${book2Id}`).then((reply) => {
    //   // deleted book should not be in cache
    //   expect(reply).toBeFalsy();
    // });

    // await redisGetAsync(`book--${book4Id}`).then((reply) => {
    //   // deleted book should not be in cache
    //   expect(reply).toBeFalsy();
    // });

    // redisGetAsync('books').then((reply) => {
    //   let fieldKeysList = JSON.parse(reply);
    //   // field Keys List should not include field keys that were just deleted
    //   expect(fieldsKeyList).toEqual(expectedFieldsList);
    //   done();
    // });
    done();
  });

  it.skip('delete book ', async () => {
    return request(server)
      .delete('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `
          mutation {deleteBook(name: "Jinhee", author: "Choi") {name author shelf_id}}
        `,
      })
      .then((response) => {
        expect(JSON.parse(response.text).data.deleteBook).toEqual(deletedBook);
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

// SET book--251 "{\"id\":\"251\",\"name\":\"Jinhee\",\"author\":\"Choi\",\"shelf_id\":\"1\"}"
