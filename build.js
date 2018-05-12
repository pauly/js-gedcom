#!/usr/bin/env node
'use strict'

var mysql = require('mysql')
var Person = require('./src/person')
if (process.argv.length !== 3) {
  throw 'usage: npm run build -- [location of your gedcom file]'
}
Person.owner = (process.env.GEDCOM_OWNER || 'I1').split(/,\n*/)

Person.parse(process.argv[2], function (err, gedcom) {
  if (err) throw err
  console.log('<!doctype html><html><head><title>js-gedcom javascript family tree parser by Paul Clarke</title>')
  console.log('<link rel="stylesheet" type="text/css" href="http://www.clarkeology.com/css/main.css" />')
  console.log('<link rel="stylesheet" type="text/css" href="http://www.clarkeology.com/css/tree.css" />')
  if (process.env.LEVELS) {
    console.log('<link rel="stylesheet" type="text/css" href="http://www.clarkeology.com/css/tree' + process.env.LEVELS + 'gen.css" />')
  }
  console.log('<meta name="description" content="' + process.env.npm_package_description.replace(/"/g, '&quot;') + '" /><link rel="canonical" href="http://www.clarkeology.com/names/clarke/7/paul+leslie" />')
  console.log('</head><body>')
  console.log('<p><a href="' + process.env.npm_package_homepage + '">' + process.env.npm_package_name + '</a>, a project on github...</p>')

  var owner = Person.owner.map(function (id) {
    return Person.singleton(id, gedcom)
  })
  console.log(owner[0].page(2, process.env.LEVELS || 3))

  // now the whole gedcom is in a quirky format in $gedcom, try:
  // console.log(gedcom.INDI.I1.name(), 'father is', gedcom.INDI.I1.father().name());
  // console.log(gedcom.INDI.I1.name(), 'maternal grandfather is', gedcom.INDI.I1.mother().father().name());

  if (!process.env.MYSQL_USER) return
  var config = {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    connectTimeout: 60000
  }
  var connection = mysql.createConnection(config)
  connection.connect()
  for (var id in gedcom.INDI) {
    var person = Person.singleton(id, gedcom)
    var metaRelationship = person.shortName() + ' is in our family tree'
    var relationship = person.relationship(owner)
    if (relationship) metaRelationship = relationship
    if (person.father().id() > 0 || person.mother().id() > 0) {
      metaRelationship += ' and ' + person.childType() + ' of '
      if (person.father().id() > 0) {
        metaRelationship += person.father().name(false, true)
      }
      if (person.father().id() > 0 || person.mother().id() > 0) {
        metaRelationship += ' and '
      }
      if (person.mother().id() > 0) {
        metaRelationship += person.mother().name(false, true)
      }
    }
    var summary = person.page().replace(/\n/g, '') + '\n\n' + relationship
    var data = [
      person.isAlive() ? 0 : 1,
      person.name(),
      person.surname(),
      'I' + person.id(),
      person.years(),
      metaRelationship.replace(/<[^>]*?>/g, ''),
      person.link(),
      summary,
      person.isPrivate()
    ]
    connection.query('replace into pgv_individuals set i_isdead = ?, i_name = ?, i_surname = ?, i_id = ?, years = ?, meta = ?, link = ?, summary = ?, private = ?', data, function (dbError) {
      if (dbError) throw dbError
    })
  }
  console.log('</body></html>')
  connection.end()
})
