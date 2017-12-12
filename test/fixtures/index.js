// node core modules

// 3rd party modules
const _ = require('lodash');

// internal modules
const OniyiVcardParser = require('../../lib');


const init = () => {
  const options = {
    vCardToJSONAttributeMapping: {
      fooVCard: 'fooJson',
      'fooVCard;barVCard': 'fooBarJson',
      'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID': 'extattr',
      complexVCard: 'complexAttr',
    },
    complexJSONAttributes: {
      complexAttr: ['Hello', 'test'],
    },
  };
  const buildVCardExtAttr = (id, value) => `X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:${id};VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:${value};VALUE=X_EXTENSION_DATA_TYPE:`; // eslint-disable-line max-len

  const vCard = new OniyiVcardParser(options);

  return { vCard, options, buildVCardExtAttr };
};

const initContext = t => _.assign(t.context, init());

module.exports = {
  initContext,
};
