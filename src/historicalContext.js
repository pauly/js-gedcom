'use strict';

const historicalData = require('../data/historicalData');

const historicalContext = module.exports = {};

historicalContext.during = (year, line) => Boolean(year && line && line[0] && line[1] && year >= line[0] && year <= line[1]);

historicalContext.before = (year, line) => Boolean(year && line && line[0] && year < line[0]);

historicalContext.fact = (birthYear, deathYear, data) => {
  if (!data) data = historicalData;
  if (!birthYear && !deathYear) return '';
  const usableFacts = data.reduce((facts, line) => {
    ['during', 'before'].forEach(comparison => {
      if (historicalContext[comparison](birthYear, line) || historicalContext[comparison](deathYear, line)) {
        facts.push(`${comparison} ${line[2]}`);
      }
    });
    return facts;
  }, []);
  return usableFacts[0] || '';
};

