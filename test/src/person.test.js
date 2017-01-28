/* global it, describe, beforeEach, afterEach, expect, sandbox */
'use strict'

const Person = require('../../src/person')
const path = require('path')

describe('Person', () => {
  let paul
  let mysteryPerson

  beforeEach(() => {
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
    }
    paul = new Person('I1', Person._gedcom)
    mysteryPerson = new Person('I2', Person._gedcom)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('arrayIntersect', () => {
    it('tells us if two arrays intersect', () => {
      expect(Person._arrayIntersect([1, 2], [2, 3])).to.be.true()
    })

    it('tells us if two arrays do not intersect', () => {
      expect(Person._arrayIntersect([1, 2], [3, 4])).to.be.false()
    })
  })

  describe('init', () => {
    it('assigns empty data for someone who does not exist', () => {
      const test = new Person()
      expect(test._data).to.deep.equal({})
    })
  })

  describe('parse', () => {
    it('parses', done => {
      const file = path.resolve(__dirname, '../../data/Dummy.ged')
      Person.parse(file, (err, gedcom) => {
        expect(err).to.be.null()
        expect(gedcom).to.be.ok()
        done()
      })
    })

    it('handles a missing file', done => {
      Person.parse('missing/file', (err, gedcom) => {
        expect(err).to.be.ok()
        expect(gedcom).to.be.undefined()
        done()
      })
    })
  })

  describe('_id', () => {
    it('cleans up an object', () => {
      expect(Person._id({ _ID: '@foo' })).to.equal('foo')
    })

    it('cleans up a string', () => {
      expect(Person._id('@foo')).to.equal('foo')
    })

    it('is ok with bad data', () => {
      expect(Person._id()).to.be.null()
    })
  })

  describe('id', () => {
    it('gets id', () => {
      expect(paul.id()).to.equal('1')
    })
  })

  describe('name', () => {
    let result
    beforeEach(() => {
      sandbox.stub(paul, '_partOfName').returns('NAME')
      result = paul.name('foo', 'bar')
    })

    it('calls part of name', () => {
      expect(paul._partOfName).to.have.been.calledWithExactly('NAME', 'foo', 'bar')
    })

    it('returns what part of name says', () => {
      expect(result).to.equal('NAME')
    })

    it.skip('respects privacy', () => {
      sandbox.stub(paul, 'isPrivate').returns(true)
      expect(paul.name()).to.equal('[PRIVATE]')
    })
  })

  describe('_partOfName', () => {
    beforeEach(() => {
      sandbox.stub(paul, 'years').returns('YEARS')
      sandbox.stub(paul, 'link').returns('LINK')
    })

    it('defaults to NAME', () => {
      expect(paul._partOfName()).to.equal('Paul Leslie CLARKE')
    })

    it('can pick other parts of name', () => {
      expect(paul._partOfName('SURN')).to.equal('Clarke')
    })

    it('will make a name a link', () => {
      expect(paul._partOfName('NAME', true)).to.equal('<a title="Paul Leslie CLARKE YEARS" href="LINK" itemprop="url sameAs"><span itemprop="name">Paul Leslie CLARKE</span></a>')
    })

    it('will add dates to a name', () => {
      expect(paul._partOfName('NAME', false, true)).to.equal('Paul Leslie CLARKE YEARS')
    })

    it('will make a name with dates a link', () => {
      expect(paul._partOfName('NAME', true, true)).to.equal('<a title="Paul Leslie CLARKE YEARS" href="LINK" itemprop="url sameAs"><span itemprop="name">Paul CLARKE</span> YEARS</a>')
    })

    it('is ok with missing data', () => {
      expect(mysteryPerson._partOfName()).to.equal('[unknown]')
    })
  })

  describe('_urlise', () => {
    it('makes a url friendly string', () => {
      expect(paul._urlise('Foo O\'Bar (etc)')).to.equal('foo-o%27bar-etc')
    })
  })

  describe('link', () => {
    it('makes a url', () => {
      expect(paul.link()).to.equal('http://www.clarkeology.com/names/clarke/1/paul-leslie')
    })

    it.skip('is ok with missing data', () => {
      expect(mysteryPerson.link()).to.equal('http://www.clarkeology.com/names/unknown/0/unknown')
    })
  })

  describe('_year', () => {
    describe('without html option', () => {
      it('gets a year out of a valid date', () => {
        expect(paul._year('BIRT')).to.equal('1972')
      })

      it('defaults to birth date', () => {
        expect(paul._year()).to.equal('1972')
      })

      it('returns an empty string if no date type', () => {
        expect(paul._year('foo')).to.equal('')
      })

      it('returns an empty string if no date', () => {
        expect(paul._year('NAME')).to.equal('')
      })

      it('gets a year out of an approximate date', () => {
        expect(paul._year('DEAT')).to.equal('3000')
      })

      it('gets a year out of an invalid date', () => {
        expect(paul._year('BAPM')).to.equal('unknown')
      })

      it('will not add schema to an invalid date', () => {
        expect(paul._year('BAPM', true)).to.equal('unknown')
      })
    })

    describe('with html option', () => {
      it('gets a year out of a valid date', () => {
        expect(paul._year('BIRT', true)).to.equal('<time itemprop="birthDate" datetime="1972-07-27">1972</time>')
      })

      it('defaults to birth date', () => {
        expect(paul._year(null, true)).to.equal('<time itemprop="birthDate" datetime="1972-07-27">1972</time>')
      })

      it('returns an empty string if no date type', () => {
        expect(paul._year('foo', true)).to.equal('')
      })

      it('returns an empty string if no date', () => {
        expect(paul._year('NAME', true)).to.equal('')
      })

      it('gets a year out of an approximate date', () => {
        expect(paul._year('DEAT', true)).to.equal('<time itemprop="deathDate" datetime="3000-01-01">3000</time>')
      })

      it('gets a year out of an invalid date', () => {
        expect(paul._year('BAPM', true)).to.equal('unknown')
      })

      it('will not add schema to an invalid date', () => {
        expect(paul._year('BAPM', true)).to.equal('unknown')
      })
    })
  })

  describe('years', () => {
    beforeEach(() => {
      sandbox.stub(paul, '_year').returns('')
    })

    it('shows both years', () => {
      paul._year.withArgs('BIRT').returns('1000')
      paul._year.withArgs('DEAT').returns('3000')
      expect(paul.years()).to.equal('1000 - 3000')
    })

    it('shows only birth year', () => {
      paul._year.withArgs('BIRT').returns('1000')
      expect(paul.years()).to.equal('1000 -')
    })

    it('shows only death year', () => {
      paul._year.withArgs('DEAT').returns('3000')
      expect(paul.years()).to.equal('- 3000')
    })

    it('shows neither', () => {
      expect(paul.years()).to.equal('')
    })
  })

  describe('gender', () => {
    it('shows gender', () => {
      expect(paul.gender()).to.equal('M')
    })

    it('is ok with bad data', () => {
      expect(mysteryPerson.gender()).to.be.null()
    })
  })

  describe('i18n', () => {
    it('does nothing', () => {
      expect(Person.i18n('foo')).to.equal('foo')
    })
  })

  describe('htmlTree', () => {
    it('works', () => {
      expect(paul.htmlTree()).to.be.ok()
    })
  })

  describe('familiesWithSpouse', () => {
    it('works', () => {
      expect(paul.familiesWithSpouse()).to.be.ok()
    })

    it('returns an array with bad data', () => {
      expect(mysteryPerson.familiesWithSpouse()).to.be.an('array')
    })
  })

  describe('source', () => {
    it('works', () => {
      expect(paul.source()).to.be.a('string')
    })

    it('is ok with bad data', () => {
      expect(mysteryPerson.source()).to.be.a('string')
    })
  })

  describe('isAlive', () => {
    it('works', () => {
      expect(paul.isAlive()).to.be.false()
    })

    it('is ok with bad data', () => {
      expect(mysteryPerson.isAlive()).to.be.true()
    })
  })

  describe('genderNoun', () => {
    beforeEach(() => {
      sandbox.stub(paul, 'gender').returns('M')
    })
    it('returns the male word', () => {
      paul.gender.returns('M')
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('foo')
    })
    it('returns the female word', () => {
      paul.gender.returns('F')
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('bar')
    })
    it('returns the neutral word', () => {
      paul.gender.returns('X')
      expect(paul.genderNoun('foo', 'bar', 'etc')).to.equal('etc')
    })
    it('returns null if no neutral word', () => {
      paul.gender.returns('X')
      expect(paul.genderNoun('foo', 'bar')).to.be.null()
    })
  });

  ['personalPronoun', 'childType', 'siblingType', 'parentSiblingType', 'siblingChildType', 'grandParentType', 'greatGrandParentType'].forEach(method => {
    describe(method, () => {
      let result
      beforeEach(() => {
        sandbox.stub(paul, 'genderNoun').returns('foo')
        result = paul[method]()
      })
      it('calls genderNoun', () => {
        expect(paul.genderNoun).to.have.been.calledOnce()
      })
      it('returns the result', () => {
        expect(result).to.equal('foo')
      })
    })
  })

  describe('isPrivate', () => {
    it('works because user 1 is hardcoded!', () => {
      expect(paul.isPrivate()).to.be.false()
    })

    it('is ok with missing data', () => {
      expect(mysteryPerson.isPrivate()).to.be.true()
    })
  })
})
