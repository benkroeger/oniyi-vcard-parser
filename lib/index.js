/*
 *
 * https://github.com/benkroeger/oniyi-vcard-parser
 *
 * Copyright (c) 2014 Benjamin Kroeger
 * Licensed under the MIT license.
 */

'use strict';

// node core
const util = require('util');

// 3rd party
const _ = require('lodash');
const debug = require('debug')('oniyi-vcard-parser');

// internal dependencies
// none

// variables and functions
const defaults = {
  // use this object to map vCard field names to editableField names. A mapping to "false" will ignore the vCard field while parsing to JSON
  vCardToJSONAttributeMapping: {
    BEGIN: false,
    END: false,
    VERSION: false,
  },
  // use this object to define complex vCard fields; meaning those whos technical values consist more than one logical value
  complexJSONAttributes: {},
};

const extAttrSubvaluesMapping = {
  'VALUE=X_EXTENSION_KEY': 'key',
  'VALUE=X_EXTENSION_VALUE': 'value',
  'VALUE=X_EXTENSION_DATA_TYPE': 'dataType',
};

const keyValuePairRegex = /^([^:]+):(.*)/;

function VCardParser(options = {}) {
  const toJSON = _.merge(
    {},
    defaults.vCardToJSONAttributeMapping,
    options.vCardToJSONAttributeMapping
  );
  const complexJSONAttributes = _.merge(
    {},
    defaults.complexJSONAttributes,
    options.complexJSONAttributes
  );
  const toVcard = _.transform(toJSON, (result, JSONAttrName, vCardAttrName) => {
    if (_.isString(JSONAttrName)) {
      Object.assign(result, {
        [JSONAttrName]: vCardAttrName,
      });
    }

    return result;
  }, {});

  Object.assign(this, {
    complexJSONAttributes,
    mappings: {
      toJSON,
      toVcard,
    },
  });
}

/*
 * @ description: Parses a vCard 2.1 string and creates a JSON-Object with editableField names as properties containing the values from according vCardAttributes
 * @ param: {string} vCardStr - The vCard string
 *
 * @ return {json}: a structured JSON-Object containing the corresponding profile attributes
 *
 * @ author: Benjamin Kroeger < benjamin.kroeger@de.ibm.com >
 */
VCardParser.prototype.toObject = function toObject(vCardStr, encode) {
  const self = this;
  const { mappings: { toJSON }, complexJSONAttributes } = self;
  const jsonObj = {
    extattr: [],
  };
  const trimmedVCardStr = vCardStr.trim();
  // split the string on "\n" to receive singular vCardAttributes
  const validVCardAttributes = [];

  // see if the vCardAttribute starts with one of the configured JSONAttribute-mappings
  trimmedVCardStr.split('\n').forEach((vCardLine) => {
    let valid = false;
    _.forOwn(toJSON, (JSONAttrName, vCardAttrName) => { // eslint-disable-line consistent-return
      if (vCardLine.indexOf(vCardAttrName) === 0) {
        valid = true;
        if (_.isString(JSONAttrName) && JSONAttrName.length > 0) {
          validVCardAttributes.push(vCardLine);
        }
        // break from the loop
        return false;
      }
    });
    if (
      !valid &&
      _.isString(validVCardAttributes[validVCardAttributes.length - 1])
    ) {
      // no mapping was found; either it has not been configured or the value from the previous vCardAttribute contained a "\n". To prevent from data-loss, value is appended to the previous attribute.
      validVCardAttributes[validVCardAttributes.length - 1] += ` ${vCardLine}`;
    }
  });

  // iterate over identified valid vCardAttributes and split them into key / value to create JSON-Object
  validVCardAttributes.forEach((vCardEntry) => {
    const trimmedVCardEntry = vCardEntry.trim();
    if (trimmedVCardEntry.length > 1) {
      const vCardRex = trimmedVCardEntry.match(keyValuePairRegex);
      const JSONAttrName = toJSON[vCardRex[1]];

      if (_.isString(JSONAttrName)) {
        // this vCardAttribute is an extension-attribute from IBM Connections
        if (JSONAttrName === 'extattr') {
          try {
            const subValues = vCardRex[2].split(';');
            const extAttr = {
              id: subValues.shift(),
            };

            subValues.forEach((subValue) => {
              const [key, ...values] = subValue.split(':');
              const { [key]: extAttrSubValue } = extAttrSubvaluesMapping;

              if (extAttrSubValue) {
                Object.assign(extAttr, {
                  [extAttrSubValue]: values.join(':'),
                });
              }
            });

            if (encode) {
              Object.assign(extAttr, {
                value: encodeURIComponent(extAttr.value),
              });
            }

            jsonObj.extattr.push(extAttr);
          } catch (e) {
            debug('Failed to parse extension-attribute: %s', vCardEntry);
          }
          return;
        }

        if (complexJSONAttributes[JSONAttrName]) {
          // this vCardAttribute is a complex field
          jsonObj[JSONAttrName] = {};
          const valArray = vCardRex[2].split(';');
          _.forOwn(complexJSONAttributes[JSONAttrName], (val, i) => {
            _.merge(jsonObj, {
              [JSONAttrName]: {
                [val]: encode
                  ? encodeURIComponent(valArray[i])
                  : valArray[i],
              },
            });
          });
          return;
        }

        // just a normal mapping
        Object.assign(jsonObj, {
          [JSONAttrName]: encode
            ? encodeURIComponent(vCardRex[2])
            : vCardRex[2],
        });
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
VCardParser.prototype.toVcard = function toVcard(jsonObj, validAttributes) {
  const self = this;
  const { mappings: { toVcard: toVcardMapping }, complexJSONAttributes } = self;

  // define the vCard beginning
  const vCardArr = ['BEGIN:VCARD', 'VERSION:2.1'];
  const parsedValidAttributes = Array.isArray(validAttributes)
    ? validAttributes
    : _.keys(toVcardMapping);

  _.forOwn(jsonObj, (JSONAttrValue, JSONAttrName) => {
    // take only those profile fields that are configured to be editable (information coming from users service document)
    if (parsedValidAttributes.indexOf(JSONAttrName) > -1 && _.isString(toVcardMapping[JSONAttrName])) {
      const vCardAttrVal = (() => {
        if (Array.isArray(complexJSONAttributes[JSONAttrName])) {
          const values = complexJSONAttributes[JSONAttrName].map(attrName => JSONAttrValue[attrName] || '');
          return values.join(';');
        }
        if (JSONAttrName === 'extattr' && Array.isArray(JSONAttrValue)) {
          const vCardAttrValue = [];

          JSONAttrValue.forEach((extAttr) => {
            vCardAttrValue.push(util.format(
              'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:%s;VALUE=X_EXTENSION_KEY:%s;VALUE=X_EXTENSION_VALUE:%s;VALUE=X_EXTENSION_DATA_TYPE:%s', // eslint-disable-line max-len
              extAttr.id,
              extAttr.key,
              _.escape(decodeURIComponent(extAttr.value)),
              extAttr.dataType
            ));
          });
          return vCardAttrValue;
        }
        return JSONAttrValue;
      })();

      vCardArr.push(`${toVcardMapping[JSONAttrName]}:${_.escape(decodeURIComponent(vCardAttrVal))}`);
    }
  });
  vCardArr.push('END:VCARD');

  return vCardArr.join('\n\n');
};

module.exports = VCardParser;
