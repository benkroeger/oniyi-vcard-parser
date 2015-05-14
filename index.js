/*
 *
 * https://github.com/benkroeger/oniyi-vcard-parser
 *
 * Copyright (c) 2014 Benjamin Kroeger
 * Licensed under the MIT license.
 */

'use strict';

// node core
// none

// 3rd party
require('prototypes');

var _ = require('lodash'),
  debug = require('debug');

// internal dependencies
// none

// variables and functions
var moduleName = 'oniyi-vcard-parser';

var logError = debug(moduleName + ':error');
// set this namespace to log via console.error
logError.log = console.error.bind(console); // don't forget to bind to console!

var logWarn = debug(moduleName + ':warn');
// set all output to go via console.warn
logWarn.log = console.warn.bind(console);

var logDebug = debug(moduleName + ':debug');
// set all output to go via console.warn
logDebug.log = console.warn.bind(console);

var defaults = {
  // use this object to map vCard field names to editableField names. A mapping to "false" will ignore the vCard field while parsing to JSON
  vCardToJSONAttributeMapping: {
    'ADR;WORK': 'workLocation',
    'AGENT;VALUE=X_PROFILE_UID': false,
    'BEGIN': false,
    'CATEGORIES': 'tags',
    'EMAIL;INTERNET': 'email',
    'EMAIL;X_GROUPWARE_MAIL': 'groupwareEmail',
    'END': false,
    'FN': 'displayName',
    'HONORIFIC_PREFIX': 'courtesyTitle',
    'N': 'names',
    'NICKNAME': 'preferredFirstName',
    'ORG': 'organizationTitle',
    'PHOTO;VALUE=URL': 'photo',
    'REV': 'lastUpdate',
    'ROLE': 'employeeTypeDesc',
    'SOUND;VALUE=URL': 'pronounciation',
    'TEL;CELL': 'mobileNumber',
    'TEL;FAX': 'faxNumber',
    'TEL;PAGER': 'ipTelephoneNumber',
    'TEL;WORK': 'telephoneNumber',
    'TEL;X_IP': 'ipTelephoneNumber',
    'TITLE': 'jobResp',
    'TZ': 'timezone',
    'UID': false,
    'URL': 'url',
    'VERSION': false,
    'X_ALTERNATE_LAST_NAME': 'alternateLastname',
    'X_BLOG_URL;VALUE=URL': 'blogUrl',
    'X_BUILDING': 'bldgId',
    'X_COUNTRY_CODE': 'countryCode',
    'X_DEPARTMENT_NUMBER': 'deptNumber',
    'X_DEPARTMENT_TITLE': 'deptTitle',
    'X_DESCRIPTION': 'description',
    'X_EMPLOYEE_NUMBER': 'employeeNumber',
    'X_EMPTYPE': 'employeeTypeCode',
    'X_EXPERIENCE': 'experience',
    'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID': 'extattr',
    'X_FLOOR': 'floor',
    'X_IS_MANAGER': 'isManager',
    'X_LCONN_USERID': 'userid',
    'X_MANAGER_UID': 'managerUid',
    'X_NATIVE_FIRST_NAME': 'nativeFirstName',
    'X_NATIVE_LAST_NAME': 'nativeLastName',
    'X_OFFICE_NUMBER': 'officeName',
    'X_ORGANIZATION_CODE': 'orgId',
    'X_PAGER_ID': 'pagerId',
    'X_PAGER_PROVIDER': 'pagerServiceProvider',
    'X_PAGER_TYPE': 'pagerType',
    'X_PREFERRED_LANGUAGE': 'preferredLanguage',
    'X_PREFERRED_LAST_NAME': 'preferredLastName',
    'X_PROFILE_KEY': 'key',
    'X_PROFILE_TYPE': 'profileType',
    'X_PROFILE_UID': 'uid',
    'X_SHIFT': false,
    'X_WORKLOCATION_CODE': 'workLocationCode'
  },
  // use this object to define complex vCard fields; meaning those whos technical values consist more than one logical value
  complexJSONAttributes: {
    workLocation: ['skip_1', 'skip_2', 'address_1', 'address_2', 'city', 'state', 'postal_code' /*, 'country' Country is not implemented in Profiles API yet*/ ],
    names: ['surname', 'givenName']
  }
};

function VCardParser(options) {
  options = options || {};
  this._mappings = {};
  this._mappings.toJSON = _.merge({}, defaults.vCardToJSONAttributeMapping, options.vCardToJSONAttributeMapping);
  this._complexJSONAttributes = _.merge({}, defaults.complexJSONAttributes, options.complexJSONAttributes);
  this._mappings.toVcard = _.transform(this._mappings.toJSON, function(result, JSONAttrName, vCardAttrName) {
    if (_.isString(JSONAttrName)) {
      result[JSONAttrName] = vCardAttrName;
    }
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
VCardParser.prototype.toObject = function(vCardStr, encode) {
  var self = this;
  var jsonObj = {};
  vCardStr = vCardStr.trim();
  // split the string on "\n" to receive singular vCardAttributes
  var validVCardAttributes = [];

  // see if the vCardAttribute starts with one of the configured JSONAttribute-mappings
  vCardStr.split('\n').forEach(function(vCardLine) {
    var valid = false;
    _.forOwn(self._mappings.toJSON, function(JSONAttrName, vCardAttrName) {
      if (vCardLine.startsWith(vCardAttrName)) {
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
  validVCardAttributes.forEach(function(vCardEntry) {
    vCardEntry = vCardEntry.trim();
    if (vCardEntry.length > 1) {
      var vCardRex = vCardEntry.match(/^([^:]+):(.*)/);
      var JSONAttrName = self._mappings.toJSON[vCardRex[1]];

      if (_.isString(JSONAttrName)) {
        // this vCardAttribute is an extension-attribute from IBM Connections
        if (JSONAttrName === 'extattr') {
          try {
            jsonObj.extattr = jsonObj.extattr || {};
            var extattrName = vCardRex[2].split(';')[0];
            var extattrVal = (vCardRex[2].split('X_EXTENSION_VALUE:')[1]).split(';')[0];
            jsonObj.extattr[extattrName] = (encode) ? encodeURIComponent(extattrVal) : extattrVal;
          } catch (e) {
            logWarn('Failed to parse extension-attribute: %s', vCardEntry);
          }
        } else if (self._complexJSONAttributes[JSONAttrName]) {
          // this vCardAttribute is a complex field
          jsonObj[JSONAttrName] = {};
          var valArray = vCardRex[2].split(';');
          _.forOwn(self._complexJSONAttributes[JSONAttrName], function(val, i) {
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
VCardParser.prototype.toVcard = function(jsonObj, validAttributes) {
  var self = this;
  // define the vCard beginning
  var vCardArr = ['BEGIN:VCARD', 'VERSION:2.1'];
  validAttributes = Array.isArray(validAttributes) ? validAttributes : _.keys(self._mappings.toVcard);
  
  _.forOwn(jsonObj, function(JSONAttrValue, JSONAttrName) {
    // take only those profile fields that are configured to be editable (information coming from users service document)
    if (validAttributes.indexOf(JSONAttrName) > -1 && _.isString(self._mappings.toVcard[JSONAttrName])) {
      var vCardAttrVal;
      if (self._complexJSONAttributes[validAttributes]) {
        var values = _.map(JSONAttrValue, function(val) {
          return val;
        });
        vCardAttrVal = values.join(';');
      } else {
        vCardAttrVal = JSONAttrValue;
      }

      vCardArr.push(self._mappings.toVcard[JSONAttrName] + ':' + decodeURIComponent(vCardAttrVal).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
  });
  vCardArr.push('END:VCARD');
  var vCardStr = vCardArr.join('\n\n');
  return vCardStr;
};

var instance = new VCardParser();

exports.toObject = function(vCardStr, encode) {
  return instance.toObject(vCardStr, encode);
};

exports.toVcard = function(jsonObj, validAttributes) {
  return instance.toVcard(jsonObj, validAttributes);
};

exports.factory = function(options) {
  return new VCardParser(options);
};