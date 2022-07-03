'use strict'

const LineByLine = require('line-by-line')
const moment = require('moment')

const historicalContext = require('./historicalContext')

const Person = module.exports = function (id, gedcom) {
  this.init(id, gedcom)
}

Person.generationsToName = 10
Person.estimatedAgeOfGeneration = 28
Person.privateSurname = '[PRIVATE]'
Person.unknownSurname = 'unknown'
Person.baseurl = ''

Person._arrayIntersect = (array1, array2) => {
  for (const val of array1) {
    if (array2.indexOf(val) > -1) return true
  }
  return false
}

Person.singleton = data => {
  if (!Person._people) Person._people = {}
  let id = Person._id(data)
  if (!id) id = 0
  if (!Person._people[id]) {
    Person._people[id] = new Person(id)
  }
  return Person._people[id]
}

Person.parse = (file, callback) => {
  const gedcom = {}
  let id = null
  let type = null
  const lineReader = new LineByLine(file)
  lineReader.on('error', err => {
    callback(err)
  })
  let masterTag
  lineReader.on('line', line => {
    let match = /^0 @([A-Z0-9]+)@ (\w*)/.exec(line)
    if (match) {
      id = match[1]
      type = match[2]
      if (!gedcom[type]) gedcom[type] = {}
      gedcom[type][id] = { _ID: id }
    } else if (id) {
      match = /^(\d+)\s+(\w+)\s*(.*)/.exec(line)
      if (!match) return // blank line probably
      const num = match[1] / 1
      const tag = match[2]
      const data = match[3]
      if (num === 1) masterTag = tag
      if (!gedcom[type][id][masterTag]) gedcom[type][id][masterTag] = {}
      if (!gedcom[type][id][masterTag][tag]) gedcom[type][id][masterTag][tag] = []
      gedcom[type][id][masterTag][tag].push(data)
    }
  })
  lineReader.on('end', () => {
    Person._gedcom = gedcom
    callback(null, gedcom)
  })
}

Person.stripTags = data => {
  return ('' + data).replace(/<\/?\w+[^>]*?>/g, '')
}

Person.prototype.init = function (id, gedcom) {
  if (!gedcom) gedcom = Person._gedcom
  if (!id) {
    this._data = {}
    return
  }
  this._data = gedcom.INDI[id]

  // Guess the death date based on burial date
  if (!this.data('DEAT').DATE) {
    if (this.data('BURI').DATE) {
      if (!this._data.DEAT) this._data.DEAT = {}
      this._data.DEAT.DATE = [`before ${this.data('BURI').DATE[0]}`]
    }
  }

  // Guess the birth date based on child ages
  if (!this.data('BIRT').DATE) {
    if (this._data) {
      const guess = this.children().reduce((year, child) => {
        if (!child._year()) return year
        const estimatedYear = child._year() - Person.estimatedAgeOfGeneration
        if (estimatedYear < year) return estimatedYear
        return year
      }, Infinity)
      if (guess < Infinity) {
        if (!this._data.BIRT) this._data.BIRT = {}
        this._data.BIRT.DATE = [`EST ${guess} (guessed based on child ages)`]
      }
    }
  }
}

Person._id = id => {
  if (!id) return null
  if (id._ID) return Person._id(id._ID)
  return (`${id}`).replace(/@/g, '')
}

Person.prototype.id = function () {
  return (`${this.data('_ID')}`).replace(/[^0-9]/g, '')
}

Person.prototype.dateOfBirth = function () {
  const type = 'BIRT'
  let match = null
  if (this.data(type).DATE) {
    const time = moment(this.data(type).DATE[0], 'YYYY-MM-DD')
    const date = (time && time.isValid()) ? time.format('YYYY-MM-DD') : this.data(type).DATE[0]
    match = /(\d{4}-\d\d-\d\d)/.exec(date)
  }
  return (match && match[1]) || '0000-01-01'
}

Person._trim = string => (`${string}`).replace(/^ +/, '').replace(/ +$/, '')

Person.prototype._partOfName = function (part, link, years) {
  if (!part) part = 'NAME'
  if (!this.data('NAME')[part]) {
    if (link) return `<a href="#" title="We have missing details for this person, can you help?">${Person.unknownSurname}</a>`
    return Person.unknownSurname
  }
  if (this.isPrivate()) {
    if (link) return `<a href="#" title="These details are private">${Person.privateSurname}</a>`
    return Person.privateSurname
  }
  let name = this.data('NAME')[part][0].replace(/\//g, '')
  if (!link) {
    if (years) name = [name, this.years()].join(' ')
    return Person._trim(name)
  }
  if (years) {
    // with link and years we can trim out the middle names to save space
    const parts = name.split(' ')
    if (parts.length > 2) {
      name = `${parts[0]} ${parts[parts.length - 1]}`
    }
  }
  let html = `<a title="${this.name()} ${this.years(false)}" href="${Person.baseurl}${this.link()}" itemprop="url sameAs">`
  html += `<span itemprop="name">${name}</span>`
  if (years) {
    html += ` ${this.years(true)}`
  }
  html += '</a>'
  return html
}

Person.prototype._urlise = text => (`${text}`).replace(/\W+/g, '-').toLowerCase()

Person.prototype.link = function () {
  // @todo let /names/ be configurable
  return `/names/${this._urlise(this.surname())}/${this.id()}/${this._urlise(this.forename())}`
}

Person.prototype.name = function (link, years) {
  return this._partOfName('NAME', link, years)
}

Person.prototype.surname = function (link, years) {
  return this._partOfName('SURN', link, years)
}

Person.prototype.forename = function (link, years) {
  return this._partOfName('GIVN', link, years)
}

Person.prototype.shortName = function () {
  return this.forename().replace(/\s.*$/, '')
}

Person.prototype._year = function (type, html) {
  if (!type) type = 'BIRT'
  if (!this.data(type).DATE) return ''
  const time = moment(this.data(type).DATE[0], 'YYYY-MM-DD')
  let date = (time && time.isValid()) ? time.format('YYYY-MM-DD') : this.data(type).DATE[0]
  const match = /(\d{4})(-(\d\d)-(\d\d))?/.exec(date)
  if (match) {
    if (html && (type === 'BIRT' || type === 'DEAT')) {
      const itemprop = type === 'BIRT' ? 'birthDate' : 'deathDate'
      try {
        date = (new Date(date)).toISOString().substr(0, 10)
      } catch (e) {
        // console.log({ date, type, e })
      }
      return `<time itemprop="${itemprop}" datetime="${date}">${match[1]}</time>`
    }
    return match[1]
  }
  return date
}

Person.prototype.years = function (html) {
  if (!this._year('BIRT') && !this._year('DEAT')) return ''
  let deathYear = this._year('DEAT', html)
  if (!deathYear && !this.isAlive()) deathYear = '??'
  return Person._trim(`${this._year('BIRT', html)} - ${deathYear}`)
}

Person.prototype.data = function (tag) {
  if (!this._data) return {}
  return this._data[tag] || {}
}

Person.prototype.gender = function () {
  if (!this.data('SEX').SEX) return null
  return this.data('SEX').SEX[0]
}

Person.prototype.genderNoun = function (male, female, unknown) {
  if (this.gender() === 'M') return Person.i18n(male)
  if (this.gender() === 'F') return Person.i18n(female)
  if (unknown) return Person.i18n(unknown)
  return null
}

Person.prototype.personalPronoun = function () {
  return this.genderNoun('his', 'her', 'their')
}

Person.prototype.childType = function () {
  return this.genderNoun('son', 'daughter', 'child')
}

Person.prototype.grandchildType = function () {
  return this.genderNoun('grandson', 'granddaughter', 'grandchild')
}

Person.prototype.greatGrandchildType = function () {
  return this.genderNoun('great-grandson', 'great-granddaughter', 'great-grandchild')
}

Person.prototype.siblingType = function () {
  return this.genderNoun('brother', 'sister', 'sibling')
}

Person.prototype.parentSiblingType = function () {
  return this.genderNoun('uncle', 'aunt')
}

Person.prototype.siblingChildType = function () {
  return this.genderNoun('nephew', 'niece')
}

Person.prototype.grandParentType = function () {
  return this.genderNoun('grandfather', 'grandmother', 'grandparent')
}

Person.prototype.greatGrandParentType = function () {
  return this.genderNoun('great-grandfather', 'great-grandmother', 'great-grandparent')
}

Person.i18n = string => string

Person.prototype.familiesWithParents = function () {
  if (!this.data('FAMC').FAMC) return null
  const familyID = Person._id(this.data('FAMC').FAMC[0])
  return Person._gedcom.FAM[familyID]
}

Person.prototype.familiesWithSpouse = function () {
  if (!this.data('FAMS').FAMS) return []
  const families = []
  this.data('FAMS').FAMS.forEach(family => {
    const familyID = Person._id(family)
    families.push(Person._gedcom.FAM[familyID])
  })
  return families
}

Person.prototype.children = function () {
  if (!this._children) {
    this._children = []
    this.familiesWithSpouse().forEach(family => {
      if (!family || !family.CHIL) return
      for (const child of family.CHIL.CHIL) {
        this._children.push(Person.singleton(child))
      }
    })
    this._children.sort((a, b) => a._year() - b._year())
  }
  return this._children
}

Person.prototype.mother = function () {
  if (!this._mother) {
    const family = this.familiesWithParents()
    const mother = (family && family.WIFE) ? family.WIFE.WIFE[0] : null
    this._mother = Person.singleton(mother)
  }
  return this._mother
}

Person.prototype.father = function () {
  if (!this._father) {
    const family = this.familiesWithParents()
    const father = (family && family.HUSB) ? family.HUSB.HUSB[0] : null
    this._father = Person.singleton(father)
  }
  return this._father
}

Person.prototype.isAlive = function () {
  if (this.data('DEAT').DEAT) return false
  if (this._year('BIRT') && (this._year('BIRT') < 1900)) return false
  for (const child of this.children()) {
    if (child._year('BIRT') && (child._year('BIRT') < 1930)) return false
    for (const grandchild of child.children()) {
      if (grandchild._year('BIRT') && (grandchild._year('BIRT') < 1960)) return false
      /* for (const greatgrandchild of grandchild.children()) {
        if (greatgrandchild.children()) return false
      } */
    }
  }
  return true
}

// @todo fix this to use "owner" instead
Person.prototype.isOwner = function () {
  return (Person.owner || []).indexOf('I' + this.id()) > -1
}

Person.prototype.isPrivate = function () {
  if (!this.id()) return false
  if (this.isOwner()) return false
  return this.isAlive()
}

Person.prototype._place = function (type, itemProp, defaultValue) {
  if (!this.data(type).PLAC) return defaultValue
  if (!this.data(type).PLAC.length) return defaultValue
  if (!itemProp) return this.data(type).PLAC.join('')
  return `<meta itemprop="${itemProp}" content="${this.data(type).PLAC.join()}" />`
}

Person.prototype.will = function () {
  const year = this._year('DEAT')
  if (!year) return null
  if (year < 1858) return null
  return `<a href="https://probatesearch.service.gov.uk/Calendar?surname=${this._urlise(this.surname())}&yearOfDeath=${year}&page=1#calendar">${this.name()}'s will</a>`
}

Person.prototype.spouses = function () {
  if (!this._spouses) {
    const self = this
    this._spouses = []
    this.familiesWithSpouse().forEach(family => {
      ['WIFE', 'HUSB'].forEach(tag => {
        if (!family[tag]) return
        family[tag][tag].forEach(spouse => {
          spouse = Person.singleton(spouse)
          if (spouse.id() !== self.id()) self._spouses.push(spouse)
        })
      })
    })
  }
  return this._spouses
}

Person.prototype.htmlTree = function (levelsOfChildren = 2, levelsOfParents = 2) {
  // pass in parents and children only for the core person
  // ⚠️ if you build more than 3 levels it makes the dom tree too deep
  // 💅 awesome css below... if a tree with 2 levels of parents and 2 of children
  // add a class of "🌳 🧓🧓 🧒🧒"

  // @todo automatically recurse this, add classes to li instead?
  if (levelsOfParents > 2) {
    if (!this.father().father().id() && !this.father().mother().id() && !this.mother().father().id() && !this.mother().mother().id()) levelsOfParents = 2
    if (!this.father().id() && !this.mother().id()) levelsOfParents = 1
  }

  return `<ul class="🌳 ${'🧓'.repeat(levelsOfParents)} ${'🧒'.repeat(levelsOfChildren)}">
    ${this.li(null, levelsOfChildren, levelsOfParents)}
  </ul>`
}

Person.prototype.homeLocation = function () {
  const location = this.data('RESI').CTRY || this._place('DEAT', false, this._place('BIRT', false, 'Unknown'))
  return `<span itemprop="homeLocation" itemscope itemtype="http://schema.org/PostalAddress">
    <meta itemprop="description" content="${location}" />
  </span>`
}

Person.prototype.li = function (relationship, levelsOfChildren, levelsOfParents) {
  const isCorePerson = Boolean(levelsOfChildren && levelsOfParents)
  let html = '<li'
  if (!this.isPrivate()) {
    if (relationship) html += ` itemprop="${relationship}"`
    if (relationship || isCorePerson) html += ' itemscope itemtype="http://schema.org/Person"'
  }
  const classes = []
  let spouse = ''
  if (!this.isPrivate() && levelsOfChildren) {
    const spouses = this.spouses()
    if (spouses.length === 1) {
      const spouseClass = (spouses[0].father().id() || spouses[0].mother().id()) ? 'class="got-parents" ' : ''
      spouse = `<div ${spouseClass}itemprop="spouse" itemscope itemtype="http://schema.org/Person">${spouses[0].name(true, true)}</div>`
      classes.push('👫')
    }
  }
  // if (this.siblings().length) {
  //   classes.push(`${this.siblings().length}-siblings`)
  // }
  var children = ''
  if (levelsOfChildren > 0 && !this.isPrivate() && this.children().length) {
    children = `<ol>
      ${this.children().map(child => child.li('children', levelsOfChildren - 1)).join('')}
    </ol>`
  }
  if (!children && !levelsOfParents) {
    classes.push('🔚')
    if (!this.isPrivate()) {
      if (this.children().length) classes.push('🧒')
      if (this.father().id() || this.mother().id()) classes.push('🧓')
    }
  }
  if (classes.length) html += ` class="${classes.join(' ')}"`
  html += '>\n'
  if (levelsOfParents > 0) {
    html += '<ul>\n'
    html += this.father().li('parent', 0, levelsOfParents - 1)
    html += this.mother().li('parent', 0, levelsOfParents - 1)
    html += '</ul>\n'
  }
  if (isCorePerson) {
    html += '<ol>\n'
    html += this.siblings(true, true).map(person => {
      if (person.id() === this.id()) {
        return person.li(null, levelsOfChildren, 0, true)
      }
      return person.li('relatedTo')
    }).join('')
    html += '</ol>\n'
  } else {
    html += `${this.name(true, true)}\n`
    if (!this.isPrivate()) {
      ['BIRT', 'DEAT'].forEach(type => {
        html += `${this._place(type, type.toLowerCase() + 'hPlace', '')}\n`
      })
      html += this.homeLocation()
    }
    html += spouse
    html += children
  }
  html += '</li>\n'
  return html
}

Person.prototype.siblings = function (includingThisPerson, exactParents) {
  const family = this.familiesWithParents()
  if (!family || !family.CHIL) {
    if (includingThisPerson) return [this]
    return []
  }
  return family.CHIL.CHIL.map(Person.singleton).filter(sibling => {
    if (exactParents) {
      if (sibling.id() !== this.id()) {
        if (this.father().id() !== sibling.father().id()) return false
        if (this.mother().id() !== sibling.mother().id()) return false
      }
    }
    if (includingThisPerson) return true
    return (sibling.id() !== this.id())
  })
}

Person.tagToLabel = tag => {
  const map = {
    BIRT: 'born',
    BAPM: 'baptised',
    DEAT: 'died',
    BURI: 'buried',
    OCCU: 'occupation'
  }
  return map[tag] ? Person.i18n(map[tag]).toUpperCase() : tag
}

Person.prototype.timeAndPlace = function (tag) {
  const timeAndPlace = []
  if (this.data(tag).DATE) timeAndPlace.push(this.data(tag).DATE[0])
  if (this.data(tag).PLAC) timeAndPlace.push(this.data(tag).PLAC[0])
  if (this.data(tag).NOTE) timeAndPlace.push(`(${this.note(this.data(tag).NOTE)})`)
  if (this.data(tag).SOUR) timeAndPlace.push(`(source: ${this.source(this.data(tag).SOUR)})`)
  if (timeAndPlace.length) timeAndPlace.unshift(Person.tagToLabel(tag).toUpperCase())
  return timeAndPlace.join(' ')
}

Person.prototype.parentIDs = function (levelRequired, thisLevel) {
  if (!levelRequired) levelRequired = 1
  if (!thisLevel) thisLevel = 1
  let ancestors = [];
  ['father', 'mother'].forEach(parent => {
    if (this[parent]().id()) {
      if (levelRequired === thisLevel) {
        ancestors.push(this[parent]().id())
      } else {
        ancestors = ancestors.concat(this[parent]().parentIDs(levelRequired, thisLevel + 1))
      }
    }
  })
  return ancestors
}

Person.prototype.ancestorIDs = function () {
  let ancestors = []
  if (this.father().id()) {
    ancestors.push(this.father().id())
    ancestors = ancestors.concat(this.father().ancestorIDs())
  }
  if (this.mother().id()) {
    ancestors.push(this.mother().id())
    ancestors = ancestors.concat(this.mother().ancestorIDs())
  }
  return ancestors
}

Person.prototype.descendentIDs = function () {
  let descendents = []
  for (const child of this.children()) {
    descendents.push(child.id())
    descendents = descendents.concat(child.children())
  }
  return descendents
}

Person.prototype.hasAncestor = function (person, level, debug) {
  if (!level) level = 1
  for (const parent of ['father', 'mother']) {
    if (this[parent]().id()) {
      if (person.id() === this[parent]().id()) return level
      const newLevel = this[parent]().hasAncestor(person, level + 1, debug)
      if (newLevel) return newLevel
    }
  }
  return false
}

Person.prototype.relationship = function (people) {
  for (const person of people) {
    const relationship = this._relationship(person)
    if (relationship) {
      return `${this.shortName()} is ${relationship} to ${person.name(true)}`
    }
  }
  return null
}

// once, twice, three times a lady...
Person.commodore = number => {
  if (number === 1) return Person.i18n('once')
  if (number === 2) return Person.i18n('twice')
  return `${number}x`
}

Person.ordinal = number => {
  if ((number % 100) >= 11 && (number % 100) <= 13) return `${number}th`
  const ends = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th']
  return number + ends[number % 10]
}

Person.ordinalSuperlative = (number, superlative) => {
  if (number === 1) return Person.i18n(superlative)
  return `${Person.ordinal(number)} ${Person.i18n(superlative)}`
}

Person.prototype.isCousinOf = function (person, thisParentLevel, otherParentLevel) {
  return Person._arrayIntersect(this.parentIDs(thisParentLevel), person.parentIDs(otherParentLevel))
}

Person.cousinDescription = (thisParentLevel, otherParentLevel) => {
  const description = `${Person.ordinal(thisParentLevel - 1)} ${Person.i18n('cousin')}`
  if (!otherParentLevel || (thisParentLevel === otherParentLevel)) return description
  return `${description} ${Person.commodore(Math.abs(thisParentLevel - otherParentLevel))} ${Person.i18n('removed')}`
}

Person.prototype._relationship = function (person) {
  if (this.id() === person.id()) return null
  for (const parent of ['father', 'mother']) {
    if (this.id() === person[parent]().id()) return Person.i18n(parent)
  }
  if (this.id() === person.father().father().id()) return Person.i18n('paternal grandfather')
  if (this.id() === person.father().mother().id()) return Person.i18n('paternal grandmother')
  if (this.id() === person.mother().father().id()) return Person.i18n('maternal grandfather')
  if (this.id() === person.mother().mother().id()) return Person.i18n('maternal grandmother')
  if (this.father().id() === person.id()) return this.childType()
  if (this.mother().id() === person.id()) return this.childType()
  if (this.father().father().id() === person.id()) return this.grandchildType()
  if (this.father().mother().id() === person.id()) return this.grandchildType()
  if (this.mother().father().id() === person.id()) return this.grandchildType()
  if (this.mother().mother().id() === person.id()) return this.grandchildType()
  let level
  if (this.ancestorIDs().indexOf(person.id()) > -1) {
    level = this.hasAncestor(person, 1)
    if (level) {
      if (level === 3) return this.greatGrandchildType()
      return `${level - 2}x ${this.greatGrandchildType()}`
    }
    return Person.i18n('descendent')
  }
  if (person.ancestorIDs().indexOf(this.id()) > -1) {
    level = person.hasAncestor(this, 1)
    if (level) {
      if (level === 3) return this.greatGrandParentType()
      return `${level - 2}x ${this.greatGrandParentType()}`
    }
    return Person.i18n('ancestor')
  }
  if (Person._arrayIntersect(this.parentIDs(), person.parentIDs())) {
    return this.siblingType()
  }
  let i
  for (i = 2; i < Person.generationsToName; i++) {
    if (Person._arrayIntersect(this.parentIDs(i), person.parentIDs(i))) return Person.cousinDescription(i)
  }

  if (Person._arrayIntersect(this.parentIDs(2), person.parentIDs())) return this.siblingChildType()
  if (Person._arrayIntersect(this.parentIDs(), person.parentIDs(2))) return this.parentSiblingType()

  for (i = 2; i < Person.generationsToName; i++) {
    for (let j = 2; j < Person.generationsToName; j++) {
      if (i === j) continue // already tested this
      if (Person._arrayIntersect(this.parentIDs(i), person.parentIDs(j))) return Person.cousinDescription(i, j)
    }
  }
  if (Person._arrayIntersect(this.ancestorIDs(), person.ancestorIDs())) return Person.i18n('related')
  return ''
}

Person.prototype.source = ids => {
  if (!ids) return ''
  const sources = []
  ids.forEach(id => {
    id = Person._id(id)
    if (!Person._gedcom.SOUR[id]) return
    for (const tag of ['_TYPE', 'TEXT']) {
      if (Person._gedcom.SOUR[id][tag]) {
        let source = ''
        if (Person._gedcom.SOUR[id][tag][tag]) {
          source += Person._gedcom.SOUR[id][tag][tag].join('')
        }
        if (Person._gedcom.SOUR[id][tag].CONC) {
          source += Person._gedcom.SOUR[id][tag].CONC.join('')
        }
        sources.push(source)
      }
    }
  })
  return sources.join('')
}

Person.prototype.note = ids => {
  let notes = []
  for (let id of ids) {
    id = Person._id(id)
    if (id) {
      for (const tag of ['CONC']) {
        if (Person._gedcom.NOTE && Person._gedcom.NOTE[id] && Person._gedcom.NOTE[id][tag]) {
          notes = notes.concat(Person._gedcom.NOTE[id][tag][tag])
        } else {
          notes.push(id)
        }
      }
    }
  }
  return Person.stripTags(notes.join(''))
}

Person.prototype.notes = function () {
  if (!this._data.NOTE) return null // @todo
  const notes = []
  if (Number(this.id()) === 7) console.warn(this._data) // @todo fix
  this._data.NOTE.NOTE.forEach((id, index) => { // @todo
    id = Person._id(id)
    if (Person._gedcom.NOTE && id in Person._gedcom.NOTE) {
      console.warn(id, 'is a reference')
      if (Person._gedcom.NOTE[id].CONT) {
        let text = ''
        Person._gedcom.NOTE[id].CONT.CONT.forEach((note, key) => {
          text += `<br /> ${note}`
          if (Person._gedcom.NOTE[id].CONC) {
            if (Person._gedcom.NOTE[id].CONC.CONC) {
              if (Person._gedcom.NOTE[id].CONC.CONC[key]) {
                text += Person._gedcom.NOTE[id].CONC.CONC[key]
              }
            }
          }
        })
        notes.push(text)
      } else if (Person._gedcom.NOTE[id].CONC) {
        notes.push(Person._gedcom.NOTE[id].CONC.CONC.join(''))
      } else console.log(`hmm no CONT or CONC in ${JSON.stringify(Person._gedcom.NOTE[id])}`)
    } else {
      if (Number(this.id()) === 7) console.warn('pushing', { index, id, 'conc?': this._data.NOTE.CONC[index] })
      notes.push(id)
      if (this._data.NOTE.CONC) {
        notes.push(this._data.NOTE.CONC[index])
        notes.splice(index, 1)
      }
    }
  })
  if (Number(this.id()) === 7) console.warn('before CONC notes:', notes)
  if (this._data.NOTE.CONC) { // in case there is any left
    this._data.NOTE.CONC.forEach(line => notes.push(line))
  }
  if (Number(this.id()) === 7) console.warn(notes)
  return Person.stripTags(notes.filter(Boolean).join(''))
}

Person.prototype.howFarBack = function (prefix) {
  const furthestBack = this.ancestorIDs().reduce((data, id) => {
    const person = Person.singleton(`I${id}`)
    const level = this.hasAncestor(person, 1)
    if (level > data.level) data = { level, person }
    return data
  }, { level: 0, person: null })
  if (furthestBack.level < 3) return ''
  const fact = historicalContext.fact(furthestBack.person._year('BIRT'), furthestBack.person._year('DEAT'))
  let text = `${[prefix || 'We can go back', furthestBack.level, 'generations to', furthestBack.person.name(true, true), fact].join(' ')}. `
  if (prefix) return text // so do not recurse...
  for (const parent of ['father', 'mother']) {
    if (!this[parent]().hasAncestor(furthestBack.person)) {
      text += this[parent]().howFarBack(`For ${this.personalPronoun()} ${parent} we go back`)
    }
  }
  return text
}

Person.prototype.ancestorStats = function () {
  const prose = []
  prose.push(`We have ${this.ancestorIDs().length || 'no'} ancestors for ${this.shortName()}`);
  ['father', 'mother'].forEach(parent => {
    if (this[parent]().id()) {
      prose.push(`, ${this[parent]().ancestorIDs().length} for ${this.personalPronoun()} ${Person.i18n(parent)} ${this[parent]().shortName()}`)
    }
  })
  prose.push('. ')
  return prose.join('')
}

Person.prototype.descendentStats = function () {
  const prose = []
  const descendents = this.descendentIDs()
  if (descendents.length) {
    prose.push(`We have ${descendents.length} descendents for ${this.shortName()}. `)
  }
  return prose.join('')
}

Person.prototype.nameStats = function () {
  const prose = []
  prose.push(`We have ${Object.keys(Person._gedcom.INDI).length} people in this family tree`)
  const countBySurname = Object.keys(Person._gedcom.INDI).reduce((count, id) => {
    const person = Person.singleton(id)
    const surname = person.surname().toLowerCase()
    count[surname] = count[surname] ? count[surname] + 1 : 1
    return count
  }, {})
  const surnamePopularity = Object.keys(countBySurname).sort((a, b) => countBySurname[b] - countBySurname[a]).filter(surname => surname !== Person.privateSurname.toLowerCase() && surname !== Person.unknownSurname.toLowerCase())
  prose.push(` with ${surnamePopularity.length} different surnames`)
  // prose.push(' (top three are ' + surnamePopularity.slice(0, 3).join(', ') + ')');
  if (this.surname() === Person.unknownSurname) {
    return prose.join('')
  }
  const lowerCaseSurname = this.surname().toLowerCase()
  if (countBySurname[lowerCaseSurname] === 1) {
    prose.push(`, but only one ${this.surname()}... `)
  } else {
    prose.push(`, including ${countBySurname[lowerCaseSurname]} called ${this.surname()}. `)
  }
  if (surnamePopularity.indexOf(lowerCaseSurname) < 10) {
    prose.push(`${this.surname()} is the ${Person.ordinalSuperlative(surnamePopularity.indexOf(lowerCaseSurname) + 1, 'most common')} name in our family tree. `)
  }
  return prose.join('')
}

Person.prototype.page = function (levelsOfChildren, levelsOfParents) {
  const parts = []
  if (!this.isPrivate()) {
    // var occupation = this.occupation();
    // if (occupation) parts.push(occupation);
    // if (this.occupation()) parts.push(this.occupation());
    ['BIRT', 'BAPM', 'DEAT', 'BURI'].forEach(tag => {
      const content = this.timeAndPlace(tag, true)
      if (content) parts.push(content)
    })
    if (this.notes()) parts.push(this.notes().replace(/ & /g, ' &amp; ')) // @todo fix
    if (this.will()) parts.push(`<p>${this.will()}</p>`)
  }
  parts.push(this.htmlTree(levelsOfChildren, levelsOfParents))
  // if (this._data.SOUR) parts.push('Source: ' + this.source(this.data('SOUR').SOUR)); // @todo
  if (this.isPrivate()) {
    parts.push(`Respecting the privacy of ${this.name()} (at least partly!).
      If you are ${this.name()} and you would like more of your details removed
      from this site please get in touch. Likewise if you can offer more
      details of your family tree, please also drop me a line!`) // @todo i18n
  }
  parts.push(`${Person.i18n('father').toUpperCase()} ${this.father().name(false, !this.father().isPrivate())}`)
  parts.push(`${Person.i18n('mother').toUpperCase()} ${this.mother().name(false, !this.mother().isPrivate())}`)
  if (!this.isPrivate()) {
    this.spouses().forEach(spouse => {
      parts.push(`${Person.i18n('spouse').toUpperCase()} ${spouse.name(!spouse.isPrivate(), !spouse.isPrivate())}`)
    })
  }
  if (!this.isPrivate()) {
    const siblings = this.siblings().map(sibling => sibling.name(!sibling.isPrivate(), !sibling.isPrivate()))
    if (siblings.length) parts.push(`${Person.i18n('siblings').toUpperCase()}: ${siblings.join(', ')}`)
  }

  const prose = []
  prose.push(this.ancestorStats())
  const fact = historicalContext.fact(this._year('BIRT'), this._year('DEAT'))
  if (fact) prose.push(`${this.shortName()} lived ${fact}. `)
  prose.push(this.howFarBack())
  prose.push(this.descendentStats())
  prose.push(this.nameStats())
  parts.push(prose.join(''))
  return parts.reduce((html, content) => {
    if (!/<\w/.test(content)) content = `<p>${content}</p>`
    return html + content
  }, '')
}
