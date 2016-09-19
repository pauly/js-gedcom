# js-gedcom

GEDCOM parser and output formatter with micro formats

src/person.js is a library of gedcom rools, example.js is an example file how to use it. I'm using it to parse data and then inject into a database.

A work very much in progress. A port of my original https://github.com/pauly/php-gedcom

## install
```
npm install
```

## build
```
npm run build -- data/Clarke.ged
```
This will update the database, and build a sample page to the docs/ folder.

## test

```
npm test
```
