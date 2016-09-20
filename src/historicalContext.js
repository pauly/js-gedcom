'use strict';

var historicalData = require('../data/historicalData');

var historicalContext = module.exports = {};

var during = function(year, line) {
  return (year && line[0] && line[1] && year >= line[0] && year <= line[1]);
};

var before = function(year, line) {
  return (year && line[0] && year < line[1]);
};

historicalContext.fact = function(birthYear, deathYear) {
  if (!birthYear && !deathYear) return '';
  var usableFacts = historicalData.reduce(function(facts, line) {
    if (during(birthYear, line) || during(deathYear, line)) {
      facts.push('during ' + line[2]);
    }
    if (!facts.length) {
      if (before(birthYear, line) || before(deathYear, line)) {
        facts.push('before ' + line[2]);
      }
    }
    return facts;
  }, []);
  return usableFacts[0] || '';
};

