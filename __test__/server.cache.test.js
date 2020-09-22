const mockSchema = require('../quell-server/src/mockSchema');
const mockQuery = require('../quell-server/src/mockQuery');
const { parse } = require('graphql/language/parser');
const { visit } = require('graphql/language/visitor');

const QuellCache = require('../quell-server/src/quell');
const { italic } = require('chalk');
const { exportAllDeclaration } = require('@babel/types');


describe('instantiate quellCache class', () => {

  describe('correctly maps queries', () => {
    const quell = new QuellCache(mockSchema, 1000, 500);
    
    it('identifies the object type associated with each query', () => {
      expect(quell.queryMap.countries).toEqual('Country');
      expect(quell.queryMap.cities).toEqual('City');
    });

    it('identifies the object type associated with fields', () => {
      expect(quell.fieldsMap.Country.cities).toEqual('City');
    })
  });
});