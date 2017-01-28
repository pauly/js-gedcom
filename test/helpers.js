'use strict'

global.expect = require('chai')
  .use(require('dirty-chai'))
  .use(require('sinon-chai'))
  .expect

global.sinon = require('sinon')
global.sandbox = global.sinon.sandbox.create()
