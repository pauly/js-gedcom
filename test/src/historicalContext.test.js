'use strict';

let historicalContext = require('../../src/historicalContext');

describe('historicalContext', function() {

  afterEach(function() {
    sandbox.restore();
  });

  describe('before', function() {
    it('tells us if a year was before two others', function() {
      expect(historicalContext.before(1, [2, 3])).to.be.true();
    });
    it('tells us if a year was before an incomplete range', function() {
      expect(historicalContext.before(1, [2])).to.be.true();
    });
    it('tells us if a year was during two others', function() {
      expect(historicalContext.before(2, [2, 3])).to.be.false();
    });
    it('tells us if a year was after two others', function() {
      expect(historicalContext.before(4, [2, 3])).to.be.false();
    });
    it('is ok with missing range', function() {
      expect(historicalContext.before(1)).to.be.false();
    });
  });

  describe('during', function() {
    it('tells us if a year was at the beginning of two others', function() {
      expect(historicalContext.during(1, [1, 3])).to.be.true();
    });
    it('tells us if a year was at the end of two others', function() {
      expect(historicalContext.during(3, [1, 3])).to.be.true();
    });
    it('tells us if a year was between two others', function() {
      expect(historicalContext.during(2, [1, 3])).to.be.true();
    });
    it('tells us if a year was before two others', function() {
      expect(historicalContext.during(1, [2, 3])).to.be.false();
    });
    it('tells us if a year was after two others', function() {
      expect(historicalContext.during(4, [2, 3])).to.be.false();
    });
    it('is ok with missing year', function() {
      expect(historicalContext.during(null, [2, 3])).to.be.false();
    });
    it('is ok with incomplete range', function() {
      expect(historicalContext.during(4, [5])).to.be.false();
    });
    it('is ok with missing range', function() {
      expect(historicalContext.during(4)).to.be.false();
    });
  });

  describe('fact', function() {
    const data = [
      [2, 3, 'fact one'],
      [4, 5, 'fact two']
    ];
    it('does not rely on us passing in data', function() {
      expect(historicalContext.fact(1, 2)).to.be.ok();
    });
    it('returns no fact with no dates', function() {
      expect(historicalContext.fact(null, null, data)).to.equal('');
    });
    it('gives us the first fact that fits dates', function() {
      expect(historicalContext.fact(1, 2, data)).to.equal('during fact one');
    });
    it('returns no fact if after all dates', function() {
      expect(historicalContext.fact(6, 7, data)).to.equal('');
    });
  });
});
