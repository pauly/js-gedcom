'use strict';

var Person = require('../../src/person');
var path = require('path');

describe('Person', function() {

  var paul;
  var mysteryPerson;

  beforeEach(function() {
    Person._gedcom = {
      INDI: {
        'I1': {
          _ID: '@1',
          SEX: {
            SEX: ['M']
          },
          BIRT: {
            PLAC: ['Gosport'],
            DATE: ['1972-07-27']
          },
          BAPM: {
            DATE: ['unknown']
          },
          DEAT: {
            PLAC: ['The Moon'],
            DATE: ['ABT 3000AD']
          },
          NAME: {
            NAME: ['Paul Leslie /CLARKE/'],
            GIVN: ['Paul Leslie'],
            SURN: ['Clarke']
          },
          FAMC: {
            FAMC: ['@F1']
          },
          FAMS: {
            FAMS: ['@F2']
          }
        },
        'I2': {
          _ID: '@2'
        }
      },
      FAM: {
        F1: {
          HUSB: {
            HUSB: ['@I1']
          }
        },
        F2: {
          CHIL: {
            CHIL: ['@I1']
          }
        }
      }
    };
    paul = new Person('I1', Person._gedcom);
    mysteryPerson = new Person('I2', Person._gedcom);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('arrayIntersect', function() {
    it('tells us if two arrays intersect', function() {
      expect(Person._arrayIntersect([1, 2], [2, 3])).to.be.true();
    });

    it('tells us if two arrays do not intersect', function() {
      expect(Person._arrayIntersect([1, 2], [3, 4])).to.be.false();
    });
  });

  describe('init', function() {
    it('assigns empty data for someone who does not exist', function() {
      var test = new Person();
      expect(test._data).to.deep.equal({});
    });
  });

  describe('parse', function() {
    it('parses', function(done) {
      var file = path.resolve(__dirname, '../../data/Dummy.ged');
      Person.parse(file, function(err, gedcom) {
        expect(err).to.be.null();
        expect(gedcom).to.be.ok();
        done();
      });
    });

    it('handles a missing file', function(done) {
      Person.parse('missing/file', function(err, gedcom) {
        expect(err).to.be.ok();
        expect(gedcom).to.be.undefined();
        done();
      });
    });
  });

  describe('_id', function() {
    it('cleans up an object', function() {
      expect(Person._id({ _ID: '@foo' })).to.equal('foo');
    });

    it('cleans up a string', function() {
      expect(Person._id('@foo')).to.equal('foo');
    });

    it('is ok with bad data', function() {
      expect(Person._id()).to.be.null();
    });
  });

  describe('id', function() {
    it('gets id', function() {
      expect(paul.id()).to.equal('1');
    });
  });

  describe('name', function() {
    var result;
    beforeEach(function() {
      sandbox.stub(paul, '_partOfName').returns('NAME');
      result = paul.name('foo', 'bar');
    });

    it('calls part of name', function() {
      expect(paul._partOfName).to.have.been.calledWithExactly('NAME', 'foo', 'bar');
    });

    it('returns what part of name says', function() {
      expect(result).to.equal('NAME');
    });

    it.skip('respects privacy', function() {
      sandbox.stub(paul, 'isPrivate').returns(true);
      expect(paul.name()).to.equal('[PRIVATE]');
    });
  });

  describe('_partOfName', function() {
    beforeEach(function() {
      sandbox.stub(paul, 'years').returns('YEARS');
      sandbox.stub(paul, 'link').returns('LINK');
    });

    it('defaults to NAME', function() {
      expect(paul._partOfName()).to.equal('Paul Leslie CLARKE');
    });

    it('can pick other parts of name', function() {
      expect(paul._partOfName('SURN')).to.equal('Clarke');
    });

    it('will make a name a link', function() {
      expect(paul._partOfName('NAME', true)).to.equal('<a title="Paul Leslie CLARKE YEARS" href="LINK" itemprop="url sameAs"><span itemprop="name">Paul Leslie CLARKE</span></a>');
    });

    it('will add dates to a name', function() {
      expect(paul._partOfName('NAME', false, true)).to.equal('Paul Leslie CLARKE YEARS');
    });

    it('will make a name with dates a link', function() {
      expect(paul._partOfName('NAME', true, true)).to.equal('<a title="Paul Leslie CLARKE YEARS" href="LINK" itemprop="url sameAs"><span itemprop="name">Paul Leslie CLARKE</span> YEARS</a>');
    });

    it('is ok with missing data', function() {
      expect(mysteryPerson._partOfName()).to.equal('<a title="We have missing details for this person, can you help?">[unknown]</a>');
    });
  });

  describe('_urlise', function() {
    it('makes a url friendly string', function() {
      expect(paul._urlise('Foo O\'Bar (etc)')).to.equal('foo-o%27bar-etc');
    });
  });

  describe('link', function() {
    it('makes a url', function() {
      expect(paul.link()).to.equal('http://www.clarkeology.com/names/clarke/1/paul-leslie');
    });

    it.skip('is ok with missing data', function() {
      expect(mysteryPerson.link()).to.equal('http://www.clarkeology.com/names/unknown/0/unknown');
    });
  });

  describe('_year', function() {
    describe('without html option', function() {
      it('gets a year out of a valid date', function() {
        expect(paul._year('BIRT')).to.equal('1972');
      });

      it('defaults to birth date', function() {
        expect(paul._year()).to.equal('1972');
      });

      it('returns an empty string if no date type', function() {
        expect(paul._year('foo')).to.equal('');
      });

      it('returns an empty string if no date', function() {
        expect(paul._year('NAME')).to.equal('');
      });

      it('gets a year out of an approximate date', function() {
        expect(paul._year('DEAT')).to.equal('3000');
      });

      it('gets a year out of an invalid date', function() {
        expect(paul._year('BAPM')).to.equal('unknown');
      });

      it('will not add schema to an invalid date', function() {
        expect(paul._year('BAPM', true)).to.equal('unknown');
      });
    });

    describe('with html option', function() {
      it('gets a year out of a valid date', function() {
        expect(paul._year('BIRT', true)).to.equal('<time itemprop="birthDate" datetime="1972-07-27">1972</time>');
      });

      it('defaults to birth date', function() {
        expect(paul._year(null, true)).to.equal('<time itemprop="birthDate" datetime="1972-07-27">1972</time>');
      });

      it('returns an empty string if no date type', function() {
        expect(paul._year('foo', true)).to.equal('');
      });

      it('returns an empty string if no date', function() {
        expect(paul._year('NAME', true)).to.equal('');
      });

      it('gets a year out of an approximate date', function() {
        expect(paul._year('DEAT', true)).to.equal('<time itemprop="deathDate" datetime="3000-01-01">3000</time>');
      });

      it('gets a year out of an invalid date', function() {
        expect(paul._year('BAPM', true)).to.equal('unknown');
      });

      it('will not add schema to an invalid date', function() {
        expect(paul._year('BAPM', true)).to.equal('unknown');
      });
    });
  });

  describe('years', function() {
    beforeEach(function() {
      sandbox.stub(paul, '_year').returns('');
    });

    it('shows both years', function() {
      paul._year.withArgs('BIRT').returns('1000');
      paul._year.withArgs('DEAT').returns('3000');
      expect(paul.years()).to.equal('1000 - 3000');
    });

    it('shows only birth year', function() {
      paul._year.withArgs('BIRT').returns('1000');
      expect(paul.years()).to.equal('1000 -');
    });

    it('shows only death year', function() {
      paul._year.withArgs('DEAT').returns('3000');
      expect(paul.years()).to.equal('- 3000');
    });

    it('shows neither', function() {
      expect(paul.years()).to.equal('');
    });
  });

  describe('gender', function() {
    it('shows gender', function() {
      expect(paul.gender()).to.equal('M');
    });

    it('is ok with bad data', function() {
      expect(mysteryPerson.gender()).to.be.null();
    });
  });

  describe('i18n', function() {
    it('does nothing', function() {
      expect(Person.i18n('foo')).to.equal('foo');
    });
  });

  describe('htmlTree', function() {
    it('works', function() {
      expect(paul.htmlTree()).to.be.ok();
    });
  });

  describe('familiesWithSpouse', function() {
    it('works', function() {
      expect(paul.familiesWithSpouse()).to.be.ok();
    });

    it('returns an array with bad data', function() {
      expect(mysteryPerson.familiesWithSpouse()).to.be.an('array');
    });
  });

  describe('source', function() {
    it('works', function() {
      expect(paul.source()).to.be.a('string');
    });

    it('is ok with bad data', function() {
      expect(mysteryPerson.source()).to.be.a('string');
    });
  });

  describe('isAlive', function() {
    it('works', function() {
      expect(paul.isAlive()).to.be.false();
    });

    it('is ok with bad data', function() {
      expect(mysteryPerson.isAlive()).to.be.true();
    });
  });

  describe('genderNoun', function() {
    beforeEach(function() {
      sandbox.stub(paul, 'gender').returns('M');
    });
    it('returns the male word', function() {
      paul.gender.returns('M');
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('foo');
    });
    it('returns the female word', function() {
      paul.gender.returns('F');
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('bar');
    });
    it('returns the neutral word', function() {
      paul.gender.returns('X');
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('etc');
    });
    it('returns null if no neutral word', function() {
      paul.gender.returns('X');
      expect(paul.genderNoun('foo', 'bar')).to.be.null();
    });
  });

  ['personalPronoun', 'childType', 'siblingType', 'parentSiblingType', 'siblingChildType', 'grandParentType', 'greatGrandParentType'].forEach(function(method) {
    describe(method, function() {
      var result;
      beforeEach(function() {
        sandbox.stub(paul, 'genderNoun').returns('foo');
        result = paul[method]();
      });
      it('calls genderNoun', function() {
        expect(paul.genderNoun).to.have.been.calledOnce();
      });
      it('returns the result', function() {
        expect(result).to.equal('foo');
      });
    });
  });

  describe('isPrivate', function() {
    it('works because user 1 is hardcoded!', function() {
      expect(paul.isPrivate()).to.be.false();
    });

    it('is ok with missing data', function() {
      expect(mysteryPerson.isPrivate()).to.be.true();
    });
  });
});
