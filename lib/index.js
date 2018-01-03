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
  // use this object to map vCard field names to editableField names.
  // A mapping to "false" will ignore the vCard field while parsing to JSON
  vCardToJSONAttributeMapping: {
    BEGIN: false,
    END: false,
    VERSION: false,
  },
  // use this object to define complex vCard fields; meaning those whos
  // technical values consist more than one logical value
  complexJSONAttributes: {},
};

const extAttrSubvaluesMapping = {
  'VALUE=X_EXTENSION_KEY': 'key',
  'VALUE=X_EXTENSION_VALUE': 'value',
  'VALUE=X_EXTENSION_DATA_TYPE': 'dataType',
};

const keyValuePairRegex = /^([^:]+):(.*)/;

function VCardParser(options = {}) {
  const toJSON = _.merge({}, defaults.vCardToJSONAttributeMapping, options.vCardToJSONAttributeMapping);
  const complexJSONAttributes = _.merge({}, defaults.complexJSONAttributes, options.complexJSONAttributes);
  const toVcard = _.transform(
    toJSON,
    (result, JSONAttrName, vCardAttrName) => {
      if (_.isString(JSONAttrName)) {
        Object.assign(result, {
          [JSONAttrName]: vCardAttrName,
        });
      }

      return result;
    },
    {}
  );

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
  const jsonObj = { extattr: [] };

  // split the string on "\n" to receive singular vCardAttributes
  // see if the vCardAttribute starts with one of the configured JSONAttribute-mappings
  const validVCardAttributes = vCardStr
    .trim()
    .split('\n')
    .reduce((result, vCardLine) => {
      const valid = _.some(toJSON, (JSONAttrName, vCardAttrName) => {
        // eslint-disable-line consistent-return
        if (!vCardLine.startsWith(vCardAttrName)) {
          return false;
        }

        if (_.isString(JSONAttrName) && JSONAttrName.length) {
          result.push(vCardLine);
        }

        return true;
      });

      // no mapping was found; either it has not been configured or the value from
      // the previous vCardAttribute contained a "\n". To prevent from data-loss,
      // value is appended to the previous attribute.
      if (!valid && _.isString(result[result.length - 1])) {
        result[result.length - 1] += ` ${vCardLine}`; // eslint-disable-line no-param-reassign
      }

      return result;
    }, []);

  // iterate over identified valid vCardAttributes and split them into key / value to create JSON-Object
  validVCardAttributes.forEach((vCardEntry) => {
    const trimmedVCardEntry = vCardEntry.trim();
    if (!trimmedVCardEntry.length) {
      return;
    }

    const [, vCardAttrName, vCardAttrVal] = trimmedVCardEntry.match(keyValuePairRegex) || [];
    const { [vCardAttrName]: JSONAttrName } = toJSON;

    if (!_.isString(JSONAttrName)) {
      return;
    }

    // this vCardAttribute is an extension-attribute from IBM Connections
    if (JSONAttrName === 'extattr') {
      try {
        const subValues = vCardAttrVal.split(';');
        const extAttr = { id: subValues.shift() };

        subValues.forEach((subValue) => {
          const [key, ...rest] = subValue.split(':');
          const { [key]: extAttrSubValKey } = extAttrSubvaluesMapping;

          if (extAttrSubValKey && rest.length) {
            extAttr[extAttrSubValKey] = rest.join(':');
          }
        });

        if (encode) {
          extAttr.value = encodeURIComponent(extAttr.value);
        }

        jsonObj.extattr.push(extAttr);
      } catch (e) {
        debug('Failed to parse extension-attribute: %s', vCardEntry);
      }
      return;
    }

    if (Array.isArray(complexJSONAttributes[JSONAttrName])) {
      // this vCardAttribute is a complex field
      const valArray = vCardAttrVal.split(';');
      const maxI = valArray.length - 1;
      jsonObj[JSONAttrName] = complexJSONAttributes[JSONAttrName].reduce((result, complexAttrProp, i) => {
        if (i > maxI) {
          // eslint-disable-next-line max-len
          const msg = `Number of provided complexJSONAttributes for ${JSONAttrName} is larger than the number of values in ${vCardAttrVal}`;
          debug(msg);
          throw new Error(msg);
        }

        return Object.assign(result, { [complexAttrProp]: encode ? encodeURIComponent(valArray[i]) : valArray[i] });
      }, {});
      return;
    }

    // just a normal mapping
    Object.assign(jsonObj, {
      [JSONAttrName]: encode ? encodeURIComponent(vCardAttrVal) : vCardAttrVal,
    });
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
  const parsedValidAttributes = Array.isArray(validAttributes) ? validAttributes : _.keys(toVcardMapping);

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
          // since "vCardAttrVal" should return a string, we need to join the generated array.
          return vCardAttrValue.join('\n');
        }
        return JSONAttrValue;
      })();

      if (JSONAttrName === 'extattr') {
        // for this use-case, we already have fully generated vCardAttr value, no need for extra mapping
        vCardArr.push(vCardAttrVal);
        return;
      }
      vCardArr.push(`${toVcardMapping[JSONAttrName]}:${_.escape(decodeURIComponent(vCardAttrVal))}`);
    }
  });
  vCardArr.push('END:VCARD');

  return vCardArr.join('\n');
};

module.exports = VCardParser;
