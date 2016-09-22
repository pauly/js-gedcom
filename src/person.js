'use strict';

var LineByLine = require('line-by-line');
var moment = require('moment');

var historicalContext = require('./historicalContext');

var Person = module.exports = function(id, gedcom) {
  this.init(id, gedcom);
};

Person.generationsToName = 10;
Person.estimatedAgeOfGeneration = 22;
Person.privateSurname = '[PRIVATE]';
Person.unknownSurname = '[unknown]';

Person._arrayIntersect = function(array1, array2) {
  for (var val of array1) {
    if (array2.indexOf(val) > -1) return true;
  }
  return false;
};

Person.singleton = function(data) {
  if (!Person._people) Person._people = {};
  var id = Person._id(data);
  if (!id) id = -1;
  if (!Person._people[id]) {
    Person._people[id] = new Person(id);
  }
  return Person._people[id];
};

Person.parse = function(file, callback) {
  var gedcom = {};
  var id = null;
  var type = null;
  var lineReader = new LineByLine(file);
  lineReader.on('error', function(err) {
    callback(err);
  });
  var masterTag;
  lineReader.on('line', function(line) {
    var match = /^0 @([A-Z0-9]+)@ (\w*)/.exec(line);
    if (match) {
      id = match[1];
      type = match[2];
      if (!gedcom[type]) gedcom[type] = {};
      gedcom[type][id] = { _ID: id };
    } else if (id) {
      match = /^(\d+)\s+(\w+)\s*(.*)/.exec(line);
      if (!match) return; // blank line probably
      var num = match[1] / 1;
      var tag = match[2];
      var data = match[3];
      if (num === 1) masterTag = tag;
      if (!gedcom[type][id][masterTag]) gedcom[type][id][masterTag] = {};
      if (!gedcom[type][id][masterTag][tag]) gedcom[type][id][masterTag][tag] = [];
      gedcom[type][id][masterTag][tag].push(data);
    }
  });
  lineReader.on('end', function() {
    Person._gedcom = gedcom;
    callback(null, gedcom);
  });
};

Person.prototype.init = function(id, gedcom) {
  if (!gedcom) gedcom = Person._gedcom;
  if (!id) {
    this._data = {};
    return;
  }
  this._data = gedcom.INDI[id];

  // Guess the death date based on burial date
  if (!this.data('DEAT').DATE) {
    if (this.data('BURI').DATE) {
      if (!this._data.DEAT) this._data.DEAT = {};
      this._data.DEAT.DATE = ['before ' + this.data('BURI').DATE[0]];
    }
  }

  // Guess the birth date based on child ages
  if (!this.data('BIRT').DATE) {
    if (this._data) {
      if (!this._data.BIRT) this._data.BIRT = {};
      this._data.BIRT.DATE = ['EST ' + this.children().reduce(function(year, child) {
        var estimatedYear = child._year() - Person.estimatedAgeOfGeneration;
        if (estimatedYear < year) return estimatedYear;
        return year;
      }.bind(this), Infinity) + ' (guessed based on child ages)'];
    }
  }
};

Person._id = function(id) {
  if (!id) return null;
  if (id._ID) return Person._id(id._ID);
  return ('' + id).replace(/@/g, '');
};

Person.prototype.id = function() {
  return ('' + this.data('_ID')).replace(/[^0-9]/g, '');
};

Person._trim = function(string) {
  return ('' + string).replace(/^ +/, '').replace(/ +$/, '');
};

Person.prototype._partOfName = function(part, link, years) {
  if (!part) part = 'NAME';
  if (!this.data('NAME')[part]) return Person.unknownSurname;
  if (this.isPrivate()) return Person.privateSurname;
  var name = this.data('NAME')[part][0].replace(/\//g, '');
  if (!link) {
    if (years) name = [name, this.years()].join(' ');
    return Person._trim(name);
  }
  var html = '<a href="' + this.link() + '" itemprop="url sameAs">';
  html += '<span itemprop="name">' + name + '</span>';
  if (years) {
    html += ' ' + this.years(true);
  }
  html += '</a>';
  return html;
};

Person.prototype._urlise = Person.prototype._urlise = function(text) {
  return ('' + text).replace(/\s+/g, '-').replace(/[^\w'\-]/g, '').replace(/'/g, '%27').toLowerCase();
};

Person.prototype.link = function() {
  return 'http://www.clarkeology.com/names/' + this._urlise(this.surname()) + '/' + this.id() + '/' + this._urlise(this.forename());
};

Person.prototype.name = function(link, years) {
  return this._partOfName('NAME', link, years);
};

Person.prototype.surname = function(link, years) {
  return this._partOfName('SURN', link, years);
};

Person.prototype.forename = function(link, years) {
  return this._partOfName('GIVN', link, years);
};

Person.prototype.shortName = function() {
  return this.forename().replace(/\s.*$/, '');
};

Person.prototype._year = function(type, html) {
  if (!type) type = 'BIRT';
  if (!this.data(type).DATE) return '';
  var time = moment(this.data(type).DATE[0], 'YYYY-MM-DD');
  var date = (time && time.isValid()) ? time.format('YYYY-MM-DD') : this.data(type).DATE[0];
  var match = /(\d{4})(-(\d\d)-(\d\d))?/.exec(date);
  if (match) {
    if (html && (type === 'BIRT' || type === 'DEAT')) {
      var itemprop = type === 'BIRT' ? 'birthDate' : 'deathDate';
      return '<time itemprop="' + itemprop + '" datetime="' + date + '">' + match[1] + '</time>';
    }
    return match[1];
  }
  return date;
};

Person.prototype.years = function(html) {
  if (!this._year('BIRT') && !this._year('DEAT')) return '';
  return Person._trim(this._year('BIRT', html) + ' - ' + this._year('DEAT', html));
};

Person.prototype.data = function(tag) {
  if (!this._data) return {};
  return this._data[tag] || {};
};

Person.prototype.gender = function() {
  if (!this.data('SEX').SEX) return null;
  return this.data('SEX').SEX[0];
};

Person.prototype.genderNoun = function(male, female, unknown) {
  if (this.gender() === 'M') return Person.i18n(male);
  if (this.gender() === 'F') return Person.i18n(female);
  if (unknown) return Person.i18n(unknown);
  return null;
};

Person.prototype.personalPronoun = function() {
  return this.genderNoun('his', 'her', 'their');
};

Person.prototype.childType = function() {
  return this.genderNoun('son', 'daughter', 'child');
};

Person.prototype.siblingType = function() {
  return this.genderNoun('brother', 'sister', 'sibling');
};

Person.prototype.parentSiblingType = function() {
  return this.genderNoun('uncle', 'aunt');
};

Person.prototype.siblingChildType = function() {
  return this.genderNoun('nephew', 'niece');
};

Person.prototype.grandParentType = function() {
  return this.genderNoun('grandfather', 'grandmother', 'grandparent');
};

Person.prototype.greatGrandParentType = function() {
  return this.genderNoun('great-grandfather', 'great-grandmother', 'great-grandparent');
};

Person.i18n = function(string) {
  return string;
};

Person.prototype.familiesWithParents = function() {
  if (!this.data('FAMC').FAMC) return null;
  var familyID = Person._id(this.data('FAMC').FAMC[0]);
  return Person._gedcom.FAM[familyID];
};

Person.prototype.familiesWithSpouse = function() {
  if (!this.data('FAMS').FAMS) return [];
  var families = [];
  this.data('FAMS').FAMS.forEach(function(family) {
    var familyID = Person._id(family);
    families.push(Person._gedcom.FAM[familyID]);
  });
  return families;
};

Person.prototype.children = function() {
  if (!this._children) {
    this._children = [];
    this.familiesWithSpouse().forEach(function(family) {
      if (!family || !family.CHIL) return;
      for (var child of family.CHIL.CHIL) {
        this._children.push(Person.singleton(child));
      }
    }.bind(this));
    this._children.sort(function(a, b) {
      return a._year() - b._year();
    });
  }
  return this._children;
};

Person.prototype.mother = function() {
  if (!this._mother) {
    var family = this.familiesWithParents();
    var mother = (family && family.WIFE) ? family.WIFE.WIFE[0] : null;
    this._mother = Person.singleton(mother);
  }
  return this._mother;
};

Person.prototype.father = function() {
  if (!this._father) {
    var family = this.familiesWithParents();
    var father = (family && family.HUSB) ? family.HUSB.HUSB[0] : null;
    this._father = Person.singleton(father);
  }
  return this._father;
};

Person.prototype.isAlive = function() {
  if (this.data('DEAT').DEAT) return false;
  if (this._year('BIRT') && (this._year('BIRT') < 1900)) return false;
  for (var child of this.children()) {
    if (child._year('BIRT') && (child._year('BIRT') < 1930)) return false;
    for (var grandchild of child.children()) {
      if (grandchild._year('BIRT') && (grandchild._year('BIRT') < 1960)) return false;
      for (var greatgrandchild of grandchild.children()) {
        if (greatgrandchild.children()) return false;
      }
    }
  }
  return true;
};

Person.prototype.isPrivate = function() {
  if (!this.id()) return false;
  if (this.id() === '1') return false; // show dad
  if (this.id() === '7') return false; // show me
  if (this.id() === '157') return false; // show clare
  if (this.id() === '95') return false; // show jack
  return this.isAlive();
};

Person.prototype.td = function(person, schemaRelationship, cols, className) {
  var html = '    <td colspan="' + cols + '"';
  if (className) {
    html += ' class="' + className + '"';
  }
  if (!person.id()) schemaRelationship = null;
  if (person.isPrivate()) schemaRelationship = null;
  if (schemaRelationship) {
    html += ' itemprop="' + schemaRelationship + '" itemscope itemtype="http://schema.org/Person"';
  }
  html += '>\n';
  html += '      ' + person.name(true, schemaRelationship, schemaRelationship) + '\n';
  html += '    </td>\n';
  return html;
};

Person.prototype._place = function(type, itemProp, defaultValue) {
  if (!this.data(type).PLAC) return defaultValue;
  if (!this.data(type).PLAC.length) return defaultValue;
  if (!itemProp) return this.data(type).PLAC.join('');
  return '<meta itemprop="' + itemProp + '" content="' + this.data(type).PLAC.join() + '" />';
};

Person.prototype.will = function() {
  var year = this._year('DEAT');
  if (!year) return null;
  if (year < 1858) return null;
  return '<a href="https://probatesearch.service.gov.uk/Calendar?surname=' + this._urlise(this.surname()) + '&yearOfDeath=' + year + '&page=1#calendar">' + this.name() + '\'s will</a>';
};

Person.prototype.spouses = function() {
  if (!this._spouses) {
    var self = this;
    this._spouses = [];
    this.familiesWithSpouse().forEach(function(family) {
      ['WIFE', 'HUSB'].forEach(function(tag) {
        if (!family[tag]) return;
        family[tag][tag].forEach(function(spouse) {
          spouse = Person.singleton(spouse);
          if (spouse.id() !== self.id()) self._spouses.push(spouse);
        });
      });
    });
  }
  return this._spouses;
};

Person.prototype.table = function() {
  var html = '<table class="family" summary="' + this.name() + ' family tree"';
  html += ' itemscope itemtype="http://schema.org/Person"';
  html += '>\n';
  var children = this.children().map(function(child) {
    return child.name(true);
  });
  var c = children.length;
  if (!c) c = 1;
  html += '  <tr>\n';
  html += this.td(this.father().father().father(), 'relatedTo', c, 'ggparent');
  html += this.td(this.father().father().mother(), 'relatedTo', c, 'ggparent');
  html += this.td(this.father().mother().father(), 'relatedTo', c, 'ggparent');
  html += this.td(this.father().mother().mother(), 'relatedTo', c, 'ggparent');
  html += this.td(this.mother().father().father(), 'relatedTo', c, 'ggparent');
  html += this.td(this.mother().father().mother(), 'relatedTo', c, 'ggparent');
  html += this.td(this.mother().mother().father(), 'relatedTo', c, 'ggparent');
  html += this.td(this.mother().mother().mother(), 'relatedTo', c, 'ggparent');
  html += '  </tr>\n';
  html += '  <tr>\n';
  html += this.td(this.father().father(), 'relatedTo', c * 2, 'gparent');
  html += this.td(this.father().mother(), 'relatedTo', c * 2, 'gparent');
  html += this.td(this.mother().father(), 'relatedTo', c * 2, 'gparent');
  html += this.td(this.mother().mother(), 'relatedTo', c * 2, 'gparent');
  html += '  </tr>\n';

  html += '  <tr>\n';
  html += this.td(this.father(), 'parent', c * 4);
  html += this.td(this.mother(), 'parent', c * 4);
  html += '  </tr>\n';

  html += '  <tr>\n';
  html += '    <td class="self" colspan="' + c * 8 + '">\n';
  html += '      <span itemprop="name">';
  html += this.name();
  html += '</span> ' + this.years(true) + '\n';
  ['BIRT', 'DEAT'].forEach(function(type) {
    html += '      ' + this._place(type, type.toLowerCase() + 'hPlace', '') + '\n';
  }.bind(this));
  if (!this.isPrivate()) {
    var location = this.data('RESI').CTRY || this._place('DEAT', false, this._place('BIRT', false, 'Unknown'));
    html += '      <span itemprop="homeLocation" itemscope itemtype="http://schema.org/PostalAddress">\n';
    html += '        <meta itemprop="description" content="' + location + '" />\n';
    html += '      </span>\n';
  }
  html += '    </td>\n';
  html += '  </tr>\n';

  if (!this.isPrivate()) {
    html += '  <tr>\n';
    html += this.children().map(function(child) {
      return this.td(child, 'children', 8);
    }.bind(this)).join('');
    html += '  </tr>\n';
  }
  html += '</table>\n';
  return html;
};

Person.prototype.siblings = function() {
  if (!this._siblings) {
    this._siblings = [];
    var family = this.familiesWithParents();
    if (family && family.CHIL) {
      family.CHIL.CHIL.forEach(function(child) {
        var sibling = Person.singleton(child);
        if (sibling.id() !== this.id()) this._siblings.push(sibling);
      }.bind(this));
    }
  }
  return this._siblings;
};

Person.tagToLabel = function(tag) {
  const map = {
    BIRT: 'born',
    BAPM: 'baptised',
    DEAT: 'died',
    BURI: 'buried',
    OCCU: 'occupation'
  };
  return map[tag] ? Person.i18n(map[tag]).toUpperCase() : tag;
};

Person.prototype.timeAndPlace = function(tag) {
  var timeAndPlace = [];
  if (this.data(tag).DATE) timeAndPlace.push(this.data(tag).DATE[0]);
  if (this.data(tag).PLAC) timeAndPlace.push(this.data(tag).PLAC[0]);
  if (this.data(tag).NOTE) timeAndPlace.push('(' + this.note(this.data(tag).NOTE) + ')');
  if (this.data(tag).SOUR) timeAndPlace.push('(source: ' + this.source(this.data(tag).SOUR) + ')');
  if (timeAndPlace.length) timeAndPlace.unshift(Person.tagToLabel(tag).toUpperCase());
  return timeAndPlace.join(' ');
};

Person.prototype.parentIDs = function(levelRequired, thisLevel) {
  if (!levelRequired) levelRequired = 1;
  if (!thisLevel) thisLevel = 1;
  var ancestors = [];
  ['father', 'mother'].forEach(function(parent) {
    if (this[parent]().id()) {
      if (levelRequired === thisLevel) {
        ancestors.push(this[parent]().id());
      } else {
        ancestors = ancestors.concat(this[parent]().parentIDs(levelRequired, thisLevel + 1));
      }
    }
  }.bind(this));
  return ancestors;
};

Person.prototype.ancestorIDs = function() {
  var ancestors = [];
  if (this.father().id() > 0) {
    ancestors.push(this.father().id());
    ancestors = ancestors.concat(this.father().ancestorIDs());
  }
  if (this.mother().id() > 0) {
    ancestors.push(this.mother().id());
    ancestors = ancestors.concat(this.mother().ancestorIDs());
  }
  return ancestors;
};

Person.prototype.descendentIDs = function() {
  var descendents = [];
  for (var child of this.children()) {
    descendents.push(child.id());
    descendents = descendents.concat(child.children());
  }
  return descendents;
};

Person.prototype.hasAncestor = function(person, level, debug) {
  if (!level) level = 1;
  for (var parent of ['father', 'mother']) {
    if (this[parent]().id()) {
      if (person.id() === this[parent]().id()) return level;
      var newLevel = this[parent]().hasAncestor(person, level + 1, debug);
      if (newLevel) return newLevel;
    }
  }
  return false;
};

Person.prototype.relationship = function(people) {
  for (var person of people) {
    var relationship = this._relationship(person);
    if (relationship) {
      return this.shortName() + ' is ' + relationship + ' to ' + person.name(true);
    }
  }
  return null;
};

// once, twice, three times a lady...
Person.commodore = function(number) {
  if (number === 1) return Person.i18n('once');
  if (number === 2) return Person.i18n('twice');
  return number + 'x';
};

Person.ordinal = function(number) {
  if ((number % 100) >= 11 && (number % 100) <= 13) return number + 'th';
  var ends = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
  return number + ends[number % 10];
};

Person.ordinalSuperlative = function(number, superlative) {
  if (number === 1) return Person.i18n(superlative);
  return Person.ordinal(number) + ' ' + Person.i18n(superlative);
};

Person.prototype.isCousinOf = function(person, thisParentLevel, otherParentLevel) {
  return Person._arrayIntersect(this.parentIDs(thisParentLevel), person.parentIDs(otherParentLevel));
};

Person.cousinDescription = function(thisParentLevel, otherParentLevel) {
  var description = Person.ordinal(thisParentLevel - 1) + ' ' + Person.i18n('cousin');
  if (!otherParentLevel || (thisParentLevel === otherParentLevel)) return description;
  return description + ' ' + Person.commodore(Math.abs(thisParentLevel - otherParentLevel)) + ' ' + Person.i18n('removed');
};

Person.prototype._relationship = function(person) {
  if (this.id() === person.id()) return null;
  for (var parent of ['father', 'mother']) {
    if (this.id() === person[parent]().id()) return Person.i18n(parent);
  }
  if (this.id() === person.father().father().id()) return Person.i18n('paternal grandfather');
  if (this.id() === person.father().mother().id()) return Person.i18n('paternal grandmother');
  if (this.id() === person.mother().father().id()) return Person.i18n('maternal grandfather');
  if (this.id() === person.mother().mother().id()) return Person.i18n('maternal grandmother');
  if (this.father().id() === person.id()) return this.childType();
  if (this.mother().id() === person.id()) return this.childType();
  if (this.father().father().id() === person.id()) return this.grandChildType();
  if (this.father().mother().id() === person.id()) return this.grandChildType();
  if (this.mother().father().id() === person.id()) return this.grandChildType();
  if (this.mother().mother().id() === person.id()) return this.grandChildType();
  var level;
  if (this.ancestorIDs().indexOf(person.id()) > -1) {
    level = this.hasAncestor(person, 1);
    if (level) {
      if (level === 3) return this.greatGrandChildType();
      return (level - 2) + 'x ' + this.greatGrandChildType();
    }
    return Person.i18n('descendent');
  }
  if (person.ancestorIDs().indexOf(this.id()) > -1) {
    level = person.hasAncestor(this, 1);
    if (level) {
      if (level === 3) return this.greatGrandParentType();
      return (level - 2) + 'x ' + this.greatGrandParentType();
    }
    return Person.i18n('ancestor');
  }
  if (Person._arrayIntersect(this.parentIDs(), person.parentIDs())) {
    return this.siblingType();
  }
  var i;
  for (i = 2; i < Person.generationsToName; i++) {
    if (Person._arrayIntersect(this.parentIDs(i), person.parentIDs(i))) return Person.cousinDescription(i);
  }

  if (Person._arrayIntersect(this.parentIDs(2), person.parentIDs())) return this.siblingChildType();
  if (Person._arrayIntersect(this.parentIDs(), person.parentIDs(2))) return this.parentSiblingType();

  for (i = 2; i < Person.generationsToName; i++) {
    for (var j = 2; j < Person.generationsToName; j++) {
      if (i === j) continue; // already tested this
      if (Person._arrayIntersect(this.parentIDs(i), person.parentIDs(j))) return Person.cousinDescription(i, j);
    }
  }
  if (Person._arrayIntersect(this.ancestorIDs(), person.ancestorIDs())) return Person.i18n('related');
  return '';
};

Person.prototype.source = function(ids) {
  if (!ids) return '';
  var sources = [];
  ids.forEach(function(id) {
    id = Person._id(id);
    if (!Person._gedcom.SOUR[id]) return;
    for (var tag of ['_TYPE', 'TEXT']) {
      if (Person._gedcom.SOUR[id][tag]) {
        var source = '';
        if (Person._gedcom.SOUR[id][tag][tag]) {
          source += Person._gedcom.SOUR[id][tag][tag].join('');
        }
        if (Person._gedcom.SOUR[id][tag].CONC) {
          source += Person._gedcom.SOUR[id][tag].CONC.join('');
        }
        sources.push(source);
      }
    }
  });
  return sources.join('');
};

Person.prototype.note = function(ids) {
  var notes = [];
  for (var id of ids) {
    id = Person._id(id);
    if (id) {
      for (var tag of ['CONC']) {
        if (Person._gedcom.NOTE[id][tag]) {
          notes = notes.concat(Person._gedcom.NOTE[id][tag][tag]);
        } else {
          notes.push(id);
        }
      }
    }
  }
  return notes.join('');
};

Person.prototype.notes = function() {
  if (!this._data.NOTE) return null; // @todo
  var notes = [];
  this._data.NOTE.NOTE.forEach(function(id) { // @todo
    id = Person._id(id);
    if (Person._gedcom.NOTE[id].CONT) {
      var text = '';
      Person._gedcom.NOTE[id].CONT.CONT.forEach(function(note, key) {
        text += '<br /> ' + note;
        if (Person._gedcom.NOTE[id].CONC) {
          if (Person._gedcom.NOTE[id].CONC.CONC) {
            if (Person._gedcom.NOTE[id].CONC.CONC[key]) {
              text += Person._gedcom.NOTE[id].CONC.CONC[key];
            }
          }
        }
      });
      notes.push(text);
    } else {
      if (Person._gedcom.NOTE[id].CONC) {
        notes.push(Person._gedcom.NOTE[id].CONC.CONC.join(''));
      } else {
        console.log('hmm no CONT or CONC in ' + JSON.stringify(Person._gedcom.NOTE[id]));
      }
    }
  });
  return notes.join('<br />');
};

Person.prototype.howFarBack = function() {
  var furthestBack = this.ancestorIDs().reduce(function(data, id) {
    var person = Person.singleton('I' + id);
    var level = this.hasAncestor(person, 1);
    if (level > data.level) data = { level: level, person: person };
    return data;
  }.bind(this), { level: 0, person: null });
  if (furthestBack.level < 3) return '';
  var fact = historicalContext.fact(furthestBack.person._year('BIRT'), furthestBack.person._year('DEAT'));
  return ['We can go back', furthestBack.level, 'generations to', furthestBack.person.name(true, true), fact].join(' ') + '. ';
};

Person.prototype.ancestorStats = function() {
  var prose = [];
  prose.push('We have ' + this.ancestorIDs().length + ' ancestors for ' + this.shortName());
  ['father', 'mother'].forEach(function(parent) {
    if (this[parent]().id()) {
      prose.push(', ' + this[parent]().ancestorIDs().length + ' for ' + this.personalPronoun() + ' ' + Person.i18n(parent) + ' ' + this[parent]().shortName());
    }
  }.bind(this));
  prose.push('. ');
  return prose.join('');
};

Person.prototype.descendentStats = function() {
  var prose = [];
  var descendents = this.descendentIDs();
  if (descendents.length) {
    prose.push('We have ' + descendents.length + ' descendents for ' + this.shortName() + '. ');
  }
  return prose.join('');
};

Person.prototype.nameStats = function() {
  var prose = [];
  prose.push('We have ' + Object.keys(Person._gedcom.INDI).length + ' people in this family tree');
  var countBySurname = Object.keys(Person._gedcom.INDI).reduce(function(count, id) {
    var person = Person.singleton(id);
    var surname = person.surname().toLowerCase();
    count[surname] = count[surname] ? count[surname] + 1 : 1;
    return count;
  }, {});
  var surnamePopularity = Object.keys(countBySurname).sort(function(a, b) {
    return countBySurname[b] - countBySurname[a];
  }).filter(function(surname) {
    return surname !== Person.privateSurname.toLowerCase() && surname !== Person.unknownSurname.toLowerCase();
  });
  prose.push(' with ' + surnamePopularity.length + ' different surnames');
  // prose.push(' (top three are ' + surnamePopularity.slice(0, 3).join(', ') + ')');
  var lowerCaseSurname = this.surname().toLowerCase();
  if (countBySurname[lowerCaseSurname] === 1) {
    prose.push(', but only one ' + this.surname() + '... ');
  } else {
    prose.push(', including ' + countBySurname[lowerCaseSurname] + ' called ' + this.surname() + '. ');
  }
  if (surnamePopularity.indexOf(lowerCaseSurname) < 10) {
    prose.push(this.surname() + ' is the ' + Person.ordinalSuperlative(surnamePopularity.indexOf(lowerCaseSurname) + 1, 'most common') + ' name in our tree. ');
  }
  return prose.join('');
};

Person.prototype.page = function() {
  var parts = [];
  if (!this.isPrivate()) {
    // var occupation = this.occupation();
    // if (occupation) parts.push(occupation);
    ['BIRT', 'BAPM', 'DEAT', 'BURI'].forEach(function(tag) {
      var content = this.timeAndPlace(tag, true);
      if (content) parts.push(content);
    }.bind(this));
    var notes = this.notes();
    if (notes) parts.push(notes);
    var will = this.will();
    if (will) parts.push(will);
  }
  parts.push(this.table(!this.isPrivate()));
  // if (this._data.SOUR) parts.push('Source: ' + this.source(this.data('SOUR').SOUR)); // @todo
  if (this.isPrivate()) {
    parts.push('Respecting the privacy of ' + this.name() + ' (at least partly!). If you are ' + this.name() + ' and you would like more of your details removed from this site please get in touch. Likewise if you can offer more details of your family tree, please also drop me a line!'); // @todo i18n
  }
  parts.push(Person.i18n('father').toUpperCase() + ' ' + this.father().name(false, !this.father().isPrivate()));
  parts.push(Person.i18n('mother').toUpperCase() + ' ' + this.mother().name(false, !this.mother().isPrivate()));
  if (!this.isPrivate()) {
    this.spouses().forEach(function(spouse) {
      parts.push(Person.i18n('spouse').toUpperCase() + ' ' + spouse.name(!spouse.isPrivate(), !spouse.isPrivate()));
    });
  }
  if (!this.isPrivate()) {
    var siblings = this.siblings().map(function(sibling) {
      return sibling.name(!sibling.isPrivate(), !sibling.isPrivate());
    });
    if (siblings.length) parts.push(Person.i18n('siblings').toUpperCase() + ': ' + siblings.join(', '));
  }

  var prose = [];
  prose.push(this.ancestorStats());
  var fact = historicalContext.fact(this._year('BIRT'), this._year('DEAT'));
  if (fact) prose.push(this.shortName() + ' lived ' + fact + '. ');
  prose.push(this.howFarBack());
  prose.push(this.descendentStats());
  prose.push(this.nameStats());
  parts.push(prose.join(''));
  return parts.map(function(content) {
    if (content.indexOf('<table') === 0) return content;
    return '<p>' + content + '</p>';
  }).join('');
};
