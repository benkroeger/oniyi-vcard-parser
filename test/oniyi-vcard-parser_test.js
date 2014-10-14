/*global describe,it*/
'use strict';
var assert = require('assert'),
  oniyiVcardParser = require('../lib/oniyi-vcard-parser.js');

describe('oniyi-vcard-parser node module.', function() {
  it('must be awesome', function() {
    assert( oniyiVcardParser.awesome(), 'awesome');
  });
});
