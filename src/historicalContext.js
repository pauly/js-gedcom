'use strict';

const historicalData = require('../data/historicalData');

const historicalContext = module.exports = {};

historicalContext.during = function(year, line) {
  return Boolean(year && line && line[0] && line[1] && year >= line[0] && year <= line[1]);
};

historicalContext.before = function(year, line) {
  return Boolean(year && line && line[0] && year < line[0]);
};

historicalContext.fact = function(birthYear, deathYear, data) {
  if (!data) data = historicalData;
  if (!birthYear && !deathYear) return '';
  const usableFacts = data.reduce(function(facts, line) {
    ['during', 'before'].forEach(function(comparison) {
      if (historicalContext[comparison](birthYear, line) || historicalContext[comparison](deathYear, line)) {
        facts.push(comparison + ' ' + line[2]);
      }
    });
    return facts;
  }, []);
  return usableFacts[0] || '';
};

