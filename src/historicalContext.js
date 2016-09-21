'use strict';

var historicalData = require('../data/historicalData');

var historicalContext = module.exports = {};

historicalContext.during = function(year, line) {
  return (year && line[0] && line[1] && year >= line[0] && year <= line[1]);
};

historicalContext.before = function(year, line) {
  return (year && line[0] && year < line[1]);
};

historicalContext.fact = function(birthYear, deathYear) {
  if (!birthYear && !deathYear) return '';
  var usableFacts = historicalData.reduce(function(facts, line) {
    ['during', 'before'].forEach(function(comparison) {
      if (historicalContext[comparison](birthYear, line) || historicalContext[comparison](deathYear, line)) {
        facts.push(comparison + ' ' + line[2]);
      }
    });
    return facts;
  }, []);
  return usableFacts[0] || '';
};

