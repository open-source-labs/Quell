const request = require('supertest');
const redis = require('redis');

const { promisify } = require('util');

const server = 'http://localhost:3000';

const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379,
});
const redisGetAsync = promisify(redisClient.get).bind(redisClient);
const redisExistsAsync = promisify(redisClient.exists).bind(redisClient);
const redisSetAsync = promisify(redisClient.set).bind(redisClient);
const redisFlushAsync = promisify(redisClient.flushall).bind(redisClient);
const redisQuitAsync = promisify(redisClient.quit).bind(redisClient);
const redisWaitAsync = promisify(redisClient.wait).bind(redisClient);

// beforeEach(async (done) => {
//   await redisFlushAsync();
//   done();
// });

// beforeAll(async (done) => {
//   await redisFlushAsync();
//   done();
// });

afterAll(async (done) => {
  await redisQuitAsync();
  done();
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

const changeBooksByAuthor = async (name, author) => {
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

describe('Server Cache Add Mutations Invalidation Tests', () => {
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
});

describe('Server Cache Update Mutations Invalidation Tests', () => {
  test('Check if update mutation (with user specified id), updates redis cache entry', async (done) => {
    let addResponseId = await addBook('Art of War', 'Sun Tzu', 1);
    let updateResponseId = await changeBookById(
      addResponseId,
      'The Subtle Art of Not Giving a F*ck',
      'Mark Manson'
    );

    // get key value associated with key `book--${responseId}`
    await redisGetAsync(`book--${updateResponseId}`)
      .then((reply) => {
        let redisKeyValue = JSON.parse(reply);

        // redis key value should exist
        expect(redisKeyValue).toBeTruthy();

        // check if newly added redis key value, has properties we added as args in our mutation
        expect(redisKeyValue).toHaveProperty('name');
        expect(redisKeyValue).toHaveProperty('author');
        expect(redisKeyValue).toHaveProperty('shelf_id');

        // check if cache entry in redis has data we just added
        expect(redisKeyValue.name).toEqual(
          'The Subtle Art of Not Giving a F*ck'
        );
        expect(redisKeyValue.author).toEqual('Mark Manson');
        expect(redisKeyValue.shelf_id).toEqual('1');
      })
      .catch((err) => {
        // expect no errors to have happened
        expect(err).toBeFalsy();
      });
    done();
  });

  test('Check if update mutation (with no user specified id) removes relevant cache entries', async (done) => {
    let book1Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book2Id = await addBook('1967', 'George Orwell', 1);
    let book3Id = await addBook('The Notebook', 'Nicholas Sparks', 1);
    let book4Id = await addBook('1967', 'George Orwell', 1);
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
      name: '1984',
      author: 'George Orwell',
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
      name: '1984',
      author: 'George Orwell',
      shelf_id: '1',
    };
    let book5ExpVal = {
      id: book5Id,
      name: 'The Notebook',
      author: 'Nicholas Sparks',
      shelf_id: '1',
    };

    await changeBooksByAuthor('1984', 'George Orwell').then(() => {
      expect(redisGetAsync(`book--${book1Id}`)).resolves.toEqual(
        JSON.stringify(book1ExpVal)
      );
      expect(redisGetAsync(`book--${book2Id}`)).resolves.toEqual(
        JSON.stringify(book2ExpVal)
      );
      expect(redisGetAsync(`book--${book3Id}`)).resolves.toEqual(
        JSON.stringify(book3ExpVal)
      );
      expect(redisGetAsync(`book--${book4Id}`)).resolves.toEqual(
        JSON.stringify(book4ExpVal)
      );
      expect(redisGetAsync(`book--${book5Id}`)).resolves.toEqual(
        JSON.stringify(book5ExpVal)
      );
    });

    // await redisGetAsync(`book--${book2Id}`).then((book2Val) => {
    //   expect(JSON.parse(book2Val)).toEqual(book2ExpVal);
    // });
    // await redisGetAsync(`book--${book3Id}`).then((book3Val) => {
    //   expect(JSON.parse(book3Val)).toEqual(book3ExpVal);
    // });
    // await redisGetAsync(`book--${book4Id}`).then((book4Val) => {
    //   expect(JSON.parse(book4Val)).toEqual(book4ExpVal);
    // });
    // await redisGetAsync(`book--${book5Id}`).then((book5Val) => {
    //   expect(JSON.parse(book5Val)).toEqual(book5ExpVal);
    // });
    done();
  });
});

describe('Server Cache Delete Mutations Invalidation Tests', () => {
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
    await redisFlushAsync();
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

    console.log(`CHECK book--${book2Id}`);
    await redisGetAsync(`book--${book2Id}`).then((reply) => {
      // deleted book should not be in cache
      expect(reply).toBeFalsy();
    });

    await redisGetAsync(`book--${book4Id}`).then((reply) => {
      // deleted book should not be in cache
      expect(reply).toBeFalsy();
    });

    await redisGetAsync('books').then((reply) => {
      let fieldKeysList = JSON.parse(reply);
      // field Keys List should not include field keys that were just deleted
      expect(fieldKeysList).toEqual(expectedFieldsList);
    });
    done();
  });
});
