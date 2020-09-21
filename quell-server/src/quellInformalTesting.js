const mockSchema = require('./mockSchema');
const mockQuery = require('./mockQuery');

/**
 * CONNECTING TO REDIS SERVER:
 * I need to research this more. For now, I'm going to create a cache object to 
 * serve as a dummy cache. I'll need to replace those parts with the actual commands 
 * to read from and write to the redis cache.
 * The trunQ approach: they require in redis library and create a client.
 */

const createCache = function() {
  this.cache = {}
};


createCache.prototype.get = function (key) {
  return this.cache[key] || null;
};

createCache.prototype.set = function (key, value) {
  this.cache[key] = value;
};

const dummyCache = new createCache();

const quell = new QuellCache(mockSchema, 1000, 1000);
// console.log('query map:  ', quell.queryMap);
// console.log('fields map:  ', quell.fieldsMap);
// console.log('proto:   ', quell.parseAST(parse(mockQuery)));

const fakeDataComplete = {
  'Country': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'City': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'capital': 'Andorra la Vella', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'capital': 'Sucre', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'capital': 'Yerevan', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'capital': 'Pago Pago', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'capital': 'Oranjestad', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter", "population": 1052},
  'City-2': {"id": 2,"country_id": 1, "name": "La Massana", "population": 7211},
  'City-3': {"id":3,"country_id":3,"name":"Canillo","population":3292},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella","population":20430},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito","population":4013},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza","population":22233},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas","population":0},
  'City-8': {"id":8,"country_id":4,"name":"Capinota","population":5157},
  'City-9': {"id":9,"country_id":5,"name":"Camargo","population":4715},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano","population":0}
};

const fakeDataPartial = {
  'countries': ['Country-1', 'Country-2', 'Country-3', 'Country-4', 'Country-5'],
  'cities': ['City-1', 'City-2', 'City-3', 'City-4', 'City-5', 'City-6', 'City-7', 'City-8','City-9', 'City-10'],
  'Country-1': {'id': 1, 'name': 'Andorra', 'cities': ['City-1', 'City-2']},
  'Country-2': {'id': 2, 'name': 'Bolivia', 'cities': ['City-5', 'City-7']},
  'Country-3': {'id': 3, 'name': 'Armenia', 'cities': ['City-3', 'City-6']},
  'Country-4': {'id': 4, 'name': 'American Samoa', 'cities': ['City-8', 'City-4']},
  'Country-5': {'id': 5, 'name': 'Aruba', 'cities': ['City-9', 'City-10']},
  'City-1': {"id": 1, "country_id": 1, "name": "El Tarter"},
  'City-2': {"id": 2,"country_id": 1, "name": "La Massana"},
  'City-3': {"id":3,"country_id":3,"name":"Canillo"},
  'City-4': {"id":4,"country_id":4,"name":"Andorra la Vella"},
  'City-5': {"id":5,"country_id":2,"name":"Jorochito"},
  'City-6': {"id":6,"country_id":3,"name":"Tupiza"},
  'City-7': {"id":7,"country_id":2,"name":"Puearto Pailas"},
  'City-8': {"id":8,"country_id":4,"name":"Capinota"},
  'City-9': {"id":9,"country_id":5,"name":"Camargo"},
  'City-10': {"id":10,"country_id":5,"name":"Villa Serrano"}
};

const dataFromResolvers = [
  { 'capital': 'Andorra la Vella', 'cities': [{ 'population': 1052 }, { 'population': 7211 }] },
  { 'capital': 'Sucre', 'cities': [{ 'population': 4013 }, { 'population': 5157 }] },
  { 'capital': 'Yerevan', 'cities': [{ 'population': 3292 }, { 'population': 22233 }] },
  { 'capital': 'Pago Pago', 'cities': [{ 'population': 5157 }, { 'population': 20430 }] },
  { 'capital': 'Oranjestad', 'cities': [{ 'population': 4715 }, { 'population': 0 }] }
];

for (const key in fakeDataPartial) {
  dummyCache.set(key, JSON.stringify(fakeDataPartial[key]));
};
console.log(quell.query({body: { query: "{countries{id name capital cities { id name population }}}" }}));
console.log(quell.query({body: { query: "{countries{id capital cities { id name population }}}" }}));

// const cached = [
//   { name: 'George', id: 1, human: true, friends: [ { name: 'John', human: true }, { name: 'Wesley', human: true }] },
//   { name: 'Luke', id: 2, human: false, friends: [{ name: 'George', human: true }, { name: 'Jim', human: true }] },
// ];

// const uncached = [
//   { hometown: 'Newport', sports: ['hockey', 'lacrosse'], friends: [ { name: 'NoOne', human: true }, { name: 'YouKnow', human: false }, { name: 'NewFriend', human: true }] },
//   { hometown: 'Charleston', sports: ['baseball'] },
// ]

// console.log(quell.joinResponses(cached, uncached)[0].friends);
// quell.parseAST(parse(`{
//   empireHero: hero {
//   name
//   }
//   }`));