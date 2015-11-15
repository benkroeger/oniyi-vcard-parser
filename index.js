/*
 *
 * https://github.com/benkroeger/oniyi-vcard-parser
 *
 * Copyright (c) 2014 Benjamin Kroeger
 * Licensed under the MIT license.
 */

'use strict';

// node core
var util = require('util');

// 3rd party
var _ = require('lodash');

// internal dependencies
// none

// variables and functions
var defaults = {
  // use this object to map vCard field names to editableField names. A mapping to "false" will ignore the vCard field while parsing to JSON
  vCardToJSONAttributeMapping: {
    'BEGIN': false,
    'END': false,
    'VERSION': false
  },
  // use this object to define complex vCard fields; meaning those whos technical values consist more than one logical value
  complexJSONAttributes: {}
};

var extAttrSubvaluesMapping = {
  'VALUE=X_EXTENSION_KEY': 'key',
  'VALUE=X_EXTENSION_VALUE': 'value',
  'VALUE=X_EXTENSION_DATA_TYPE': 'dataType'
};

function VCardParser(options) {
  options = options || {};
  this._mappings = {};
  this._mappings.toJSON = _.merge({}, defaults.vCardToJSONAttributeMapping, options.vCardToJSONAttributeMapping);
  this._complexJSONAttributes = _.merge({}, defaults.complexJSONAttributes, options.complexJSONAttributes);
  this._mappings.toVcard = _.transform(this._mappings.toJSON, function (result, JSONAttrName, vCardAttrName) {
    if (_.isString(JSONAttrName)) {
      result[JSONAttrName] = vCardAttrName;
    }
  });
}

// Debugging
VCardParser.debug = process.env.NODE_DEBUG && /\boniyi-locker\b/.test(process.env.NODE_DEBUG);

function debug() {
  if (VCardParser.debug) {
    console.error('VCardParser %s', util.format.apply(util, arguments));
  }
}

/*
 * @ description: Parses a vCard 2.1 string and creates a JSON-Object with editableField names as properties containing the values from according vCardAttributes
 * @ param: {string} vCardStr - The vCard string
 *
 * @ return {json}: a structured JSON-Object containing the corresponding profile attributes
 *
 * @ author: Benjamin Kroeger < benjamin.kroeger@de.ibm.com >
 */
VCardParser.prototype.toObject = function (vCardStr, encode) {
  var self = this;
  var jsonObj = {};
  vCardStr = vCardStr.trim();
  // split the string on "\n" to receive singular vCardAttributes
  var validVCardAttributes = [];

  // see if the vCardAttribute starts with one of the configured JSONAttribute-mappings
  vCardStr.split('\n').forEach(function (vCardLine) {
    var valid = false;
    _.forOwn(self._mappings.toJSON, function (JSONAttrName, vCardAttrName) {
      if (vCardLine.indexOf(vCardAttrName) === 0) {
        valid = true;
        if (_.isString(JSONAttrName) && (JSONAttrName.length > 0)) {
          validVCardAttributes.push(vCardLine);
        }
        return false;
      }
    });
    if (!valid && _.isString(validVCardAttributes[validVCardAttributes.length - 1])) {
      // no mapping was found; either it has not been configured or the value from the previous vCardAttribute contained a "\n". To prevent from data-loss, value is appended to the previous attribute.
      validVCardAttributes[validVCardAttributes.length - 1] += ' ' + vCardLine;
    }
  });

  // iterate over identified valid vCardAttributes and split them into key / value to create JSON-Object
  validVCardAttributes.forEach(function (vCardEntry) {
    vCardEntry = vCardEntry.trim();
    if (vCardEntry.length > 1) {
      var vCardRex = vCardEntry.match(/^([^:]+):(.*)/);
      var JSONAttrName = self._mappings.toJSON[vCardRex[1]];

      if (_.isString(JSONAttrName)) {
        // this vCardAttribute is an extension-attribute from IBM Connections
        if (JSONAttrName === 'extattr') {
          try {
            jsonObj.extattr = jsonObj.extattr || [];
            var subValues = vCardRex[2].split(';');

            var extAttr = {
              id: subValues.shift(),
            };

            subValues.forEach(function (subValue) {
              var keyValPair = subValue.split(':');

              extAttr[extAttrSubvaluesMapping[keyValPair[0]]] = keyValPair[1];
            });

            if (encode) {
              extAttr.value = encodeURIComponent(extAttr.value);
            }

            jsonObj.extattr.push(extAttr);
          } catch (e) {
            debug('Failed to parse extension-attribute: %s', vCardEntry);
          }
        } else if (self._complexJSONAttributes[JSONAttrName]) {
          // this vCardAttribute is a complex field
          jsonObj[JSONAttrName] = {};
          var valArray = vCardRex[2].split(';');
          _.forOwn(self._complexJSONAttributes[JSONAttrName], function (val, i) {
            jsonObj[JSONAttrName][val] = (encode) ? encodeURIComponent(valArray[i]) : valArray[i];
          });
        } else {
          // just a normal mapping
          jsonObj[JSONAttrName] = (encode) ? encodeURIComponent(vCardRex[2]) : vCardRex[2];
        }
      }
    }
  });
  return jsonObj;
};

/*
 * @ description: Parses a JSON-Object with properties named as editableFields into a vCard 2.1 string
 * @ param: {json} profile - the profile object
 *
 * @ return {string}: a vCard 2.1 string
 *
 * @ author: Benjamin Kroeger < benjamin.kroeger@de.ibm.com >
 */
VCardParser.prototype.toVcard = function (jsonObj, validAttributes) {
  var self = this;
  // define the vCard beginning
  var vCardArr = ['BEGIN:VCARD', 'VERSION:2.1'];
  validAttributes = Array.isArray(validAttributes) ? validAttributes : _.keys(self._mappings.toVcard);

  _.forOwn(jsonObj, function (JSONAttrValue, JSONAttrName) {
    // take only those profile fields that are configured to be editable (information coming from users service document)
    if (validAttributes.indexOf(JSONAttrName) > -1 && _.isString(self._mappings.toVcard[JSONAttrName])) {
      var vCardAttrVal;
      if (Array.isArray(self._complexJSONAttributes[JSONAttrName])) {
        var values = self._complexJSONAttributes[JSONAttrName].map(function (attrName) {
          return JSONAttrValue[attrName] || '';
        });
        vCardAttrVal = values.join(';');
      } else if (JSONAttrName === 'extattr' && Array.isArray(JSONAttrValue)) {
        JSONAttrValue.forEach(function (extAttr) {
          vCardArr.push(
            util.format(
              'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:%s;VALUE=X_EXTENSION_KEY:%s;VALUE=X_EXTENSION_VALUE:%s;VALUE=X_EXTENSION_DATA_TYPE:%s',
              extAttr.id,
              extAttr.key,
              _.escape(decodeURIComponent(extAttr.value)),
              extAttr.dataType));
        });
        return false;
      } else {
        vCardAttrVal = JSONAttrValue;
      }

      vCardArr.push(self._mappings.toVcard[JSONAttrName] + ':' + _.escape(decodeURIComponent(vCardAttrVal)));
    }
  });
  vCardArr.push('END:VCARD');
  var vCardStr = vCardArr.join('\n\n');
  return vCardStr;
};

module.exports = VCardParser;
