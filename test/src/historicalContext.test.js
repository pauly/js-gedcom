'use strict';

let historicalContext = require('../../src/historicalContext');

describe('historicalContext', () => {

  afterEach(() => {
    sandbox.restore();
  });

  describe('before', () => {
    it('tells us if a year was before two others', () => {
      expect(historicalContext.before(1, [2, 3])).to.be.true();
    });
    it('tells us if a year was before an incomplete range', () => {
      expect(historicalContext.before(1, [2])).to.be.true();
    });
    it('tells us if a year was during two others', () => {
      expect(historicalContext.before(2, [2, 3])).to.be.false();
    });
    it('tells us if a year was after two others', () => {
      expect(historicalContext.before(4, [2, 3])).to.be.false();
    });
    it('is ok with missing range', () => {
      expect(historicalContext.before(1)).to.be.false();
    });
  });

  describe('during', () => {
    it('tells us if a year was at the beginning of two others', () => {
      expect(historicalContext.during(1, [1, 3])).to.be.true();
    });
    it('tells us if a year was at the end of two others', () => {
      expect(historicalContext.during(3, [1, 3])).to.be.true();
    });
    it('tells us if a year was between two others', () => {
      expect(historicalContext.during(2, [1, 3])).to.be.true();
    });
    it('tells us if a year was before two others', () => {
      expect(historicalContext.during(1, [2, 3])).to.be.false();
    });
    it('tells us if a year was after two others', () => {
      expect(historicalContext.during(4, [2, 3])).to.be.false();
    });
    it('is ok with missing year', () => {
      expect(historicalContext.during(null, [2, 3])).to.be.false();
    });
    it('is ok with incomplete range', () => {
      expect(historicalContext.during(4, [5])).to.be.false();
    });
    it('is ok with missing range', () => {
      expect(historicalContext.during(4)).to.be.false();
    });
  });

  describe('fact', () => {
    const data = [
      [2, 3, 'fact one'],
      [4, 5, 'fact two']
    ];
    it('does not rely on us passing in data', () => {
      expect(historicalContext.fact(1, 2)).to.be.ok();
    });
    it('returns no fact with no dates', () => {
      expect(historicalContext.fact(null, null, data)).to.equal('');
    });
    it('gives us the first fact that fits dates', () => {
      expect(historicalContext.fact(1, 2, data)).to.equal('during fact one');
    });
    it('returns no fact if after all dates', () => {
      expect(historicalContext.fact(6, 7, data)).to.equal('');
    });
  });
});
