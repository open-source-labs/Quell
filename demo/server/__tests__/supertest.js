const request = require('supertest');

const server = 'http://localhost:3000';

describe('/graphql', () => {

  describe ('POST', () => {
    it('responds with 200 status on valid request', () => {
      return request(server)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({ "query": "{countries{id}}" })
        .expect(200)
    });

    it('responds with 400 status on invalid request', () => {
      return request(server)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send("Invalid query")
        .expect(400)
    });
  });

  describe('POST || correct data in response body', () => {

    const countries = {
      "countries": [
        {
          "id": "1",
          "name": "Andorra"
        },
        {
          "id": "2",
          "name": "Bolivia"
        },
        {
          "id": "3",
          "name": "Armenia"
        },
        {
          "id": "4",
          "name": "American Samoa"
        },
        {
          "id": "5",
          "name": "Aruba"
        }
      ]
    };

    const countriesAndCities = {
      "countries": [
        {
          "id": "1",
          "name": "Andorra"
        },
        {
          "id": "2",
          "name": "Bolivia"
        },
        {
          "id": "3",
          "name": "Armenia"
        },
        {
          "id": "4",
          "name": "American Samoa"
        },
        {
          "id": "5",
          "name": "Aruba"
        }
      ],
      "cities": [
          {
            "id": "1",
            "name": "El Tarter"
          },
          {
            "id": "2",
            "name": "La Massana"
          },
          {
            "id": "3",
            "name": "Canillo"
          },
          {
            "id": "4",
            "name": "Andorra la Vella"
          },
          {
            "id": "5",
            "name": "Jorochito"
          },
          {
            "id": "6",
            "name": "Tupiza"
          },
          {
            "id": "7",
            "name": "Puearto Pailas"
          },
          {
            "id": "8",
            "name": "Capinota"
          },
          {
            "id": "9",
            "name": "Camargo"
          },
          {
            "id": "10",
            "name": "Villa Serrano"
          },
          {
            "id": "11",
            "name": "Voskevaz"
          },
          {
            "id": "12",
            "name": "Gavarr"
          },
          {
            "id": "13",
            "name": "Nizami"
          },
          {
            "id": "14",
            "name": "Metsavan"
          },
          {
            "id": "15",
            "name": "Hnaberd"
          },
          {
            "id": "16",
            "name": "Tāfuna"
          },
          {
            "id": "17",
            "name": "Aūa"
          },
          {
            "id": "18",
            "name": "Malaeimi"
          },
          {
            "id": "19",
            "name": "Taulaga"
          },
          {
            "id": "20",
            "name": "Fagatogo"
          },
          {
            "id": "21",
            "name": "Oranjestad"
          },
          {
            "id": "51",
            "name": "Paradera"
          }
        ]
    }

    const countryId = {
        "country": {
          "id": "1",
          "name": "Andorra",
          "capital": "Andorra la Vella"
        }
    }

    const countryIdWithCities = {
      "country": {
        "id": "1",
        "name": "Andorra",
        "cities": [
          {
            "id": "1",
            "name": "El Tarter",
            "population": 1052
          },
          {
            "id": "2",
            "name": "La Massana",
            "population": 7211
          },
          {
            "id": "3",
            "name": "Canillo",
            "population": 3292
          },
          {
            "id": "4",
            "name": "Andorra la Vella",
            "population": 20430
          }
        ]
      }
    }

    const countryIdWithCitiesAndCities = {
        "country": {
          "id": "1",
          "name": "Andorra",
          "cities": [
            {
              "id": "1",
              "name": "El Tarter",
              "population": 1052
            },
            {
              "id": "2",
              "name": "La Massana",
              "population": 7211
            },
            {
              "id": "3",
              "name": "Canillo",
              "population": 3292
            },
            {
              "id": "4",
              "name": "Andorra la Vella",
              "population": 20430
            }
          ]
        },
        "cities": [
          {
            "id": "1",
            "name": "El Tarter"
          },
          {
            "id": "2",
            "name": "La Massana"
          },
          {
            "id": "3",
            "name": "Canillo"
          },
          {
            "id": "4",
            "name": "Andorra la Vella"
          },
          {
            "id": "5",
            "name": "Jorochito"
          },
          {
            "id": "6",
            "name": "Tupiza"
          },
          {
            "id": "7",
            "name": "Puearto Pailas"
          },
          {
            "id": "8",
            "name": "Capinota"
          },
          {
            "id": "9",
            "name": "Camargo"
          },
          {
            "id": "10",
            "name": "Villa Serrano"
          },
          {
            "id": "11",
            "name": "Voskevaz"
          },
          {
            "id": "12",
            "name": "Gavarr"
          },
          {
            "id": "13",
            "name": "Nizami"
          },
          {
            "id": "14",
            "name": "Metsavan"
          },
          {
            "id": "15",
            "name": "Hnaberd"
          },
          {
            "id": "16",
            "name": "Tāfuna"
          },
          {
            "id": "17",
            "name": "Aūa"
          },
          {
            "id": "18",
            "name": "Malaeimi"
          },
          {
            "id": "19",
            "name": "Taulaga"
          },
          {
            "id": "20",
            "name": "Fagatogo"
          },
          {
            "id": "21",
            "name": "Oranjestad"
          },
          {
            "id": "51",
            "name": "Paradera"
          }
        ]
    }

    it('clears cache', async () => {
      return request(server)
        .get('/clearCache')
        .expect(200)
        .then((response) => {
          expect(response.text).toEqual("Redis cache successfully cleared")
        })
    })

    it('returns correct data when cache is empty || {countries{id name}}', async () => {
      return request(server)
        .post('/graphql')
        .set("Accept", "application/json")
        .send({ "query": "{countries{id name}}" })
        .expect(200)
        .then((response) => {
          // if (err) return done(err);
          expect(response.body.data).toEqual(countries)
        });
    });

    it('combines data for multiple queries from cache and database || {countries{id name} cities {id name}}', async () => {
      return request(server)
        .post('/graphql')
        .set("Accept", "application/json")
        .send({ "query": "{countries{id name} cities {id name}}" })
        .expect(200)
        .then((response) => {
          // if (err) return done(err);
          expect(response.body.data).toEqual(countriesAndCities)
        });
    });

    it('combines data for one query from cache and database || {country (id: 1) {id name capital}}', async() => {
      return request(server)
        .post('/graphql')
        .set("Accept", "application/json")
        .send({ "query": "{country (id: 1) {id name capital}}" })
        .expect(200)
        .then((response) => {
          // if (err) return done(err);
          expect(response.body.data).toEqual(countryId)
        });
    });

    it('combines data for one nested query from cache and database || {country (id: 1) {id name cities {id name population}}}', async() => {
      return request(server)
        .post('/graphql')
        .set("Accept", "application/json")
        .send({ "query": "{country (id: 1) {id name cities {id name population}}}" })
        .expect(200)
        .then((response) => {
          // if (err) return done(err);
          expect(response.body.data).toEqual(countryIdWithCities)
        });
    });

    it('returns data for multiple queries, one of them nested, with different datatype || {country (id: 1) {id name cities {id name population}} cities { id name }}', async() => {
      return request(server)
        .post('/graphql')
        .set("Accept", "application/json")
        .send({ "query": "{country (id: 1) {id name cities {id name population}} cities { id name }}" })
        .expect(200)
        .then((response) => {
          // if (err) return done(err);
          expect(response.body.data).toEqual(countryIdWithCitiesAndCities)
        });
    });
  });
  
});

