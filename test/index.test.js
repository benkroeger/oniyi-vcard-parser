// node core modules

// 3rd party modules
const test = require('ava');
const _ = require('lodash');

// internal modules
const { initContext } = require('./fixtures');

test.beforeEach(initContext);

/* Successful scenarios validations */

test('validate toObject() method, encode not provided', (t) => {
  const {
    vCard,
    buildVCardExtAttr,
    options: {
      vCardToJSONAttributeMapping: {
        fooVCard,
        'fooVCard;barVCard': fooBarVCard,
        'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID': extAttrVCard,
        complexVCard,
      },
      complexJSONAttributes: {
        fooComplex,
      },
    },
  } = t.context;

  const foo = 'I am foo';
  const fooBar = 'I am fooBar';
  const complex = 'world;data';

  const vCardString = [
    'BEGIN:VCARD',
    'VERSION:1.0',
    `fooVCard:${foo}`,
    `fooVCard;barVCard:${fooBar}`,
    buildVCardExtAttr('text', 'I am extension Value'),
    buildVCardExtAttr('date', '2017-01-04T20:32:31.171Z'),
    buildVCardExtAttr('number', 123),
    buildVCardExtAttr('test'),
    `complexVCard:${complex}`,
    'END:VCARD',
  ].join('\n');

  const vCardObject = vCard.toObject(vCardString);

  ['fooJson', 'fooBarJson', 'extattr', 'fooComplex'].forEach(item => t.true(item in vCardObject));
  t.is(vCardObject[fooVCard], foo);
  t.is(vCardObject[fooBarVCard], fooBar);

  const { [complexVCard]: complexVCardObject } = vCardObject;
  t.true(_.isPlainObject(complexVCardObject));

  const [complexKey1, complexKey2] = fooComplex;
  const [complexValue1, complexValue2] = complex.split(';');

  t.true(complexKey1 in complexVCardObject);
  t.is(complexVCardObject[complexKey1], complexValue1);

  t.true(complexKey2 in complexVCardObject);
  t.is(complexVCardObject[complexKey2], complexValue2);

  t.true(Array.isArray(vCardObject[extAttrVCard]));

  vCardObject[extAttrVCard].forEach(({ id, value }) => {
    t.true(_.isString(id));
    if (id === 'date') {
      t.true(!_.isNaN(Date.parse(value)));
    }
    t.true(_.isString(value));
  });
});

test('validate toObject() method, encode provided', (t) => {
  const {
    vCard,
    buildVCardExtAttr,
    options: {
      vCardToJSONAttributeMapping: {
        fooVCard,
        'X_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID': extAttrVCard,
        complexVCard,
      },
      complexJSONAttributes: {
        fooComplex,
      },
    },
  } = t.context;

  const foo = 'I am foo';
  const complex = 'my world;data';

  const vCardString = [
    'BEGIN:VCARD',
    'VERSION:1.0',
    `fooVCard:${foo}`,
    buildVCardExtAttr('text', 'I am extension Value'),
    `complexVCard:${complex}`,
    'END:VCARD',
  ].join('\n');

  const vCardObject = vCard.toObject(vCardString, true);

  // ['fooJson', 'extattr', 'fooComplex'].forEach(item => t.true(item in vCardObject));
  t.is(vCardObject[fooVCard], encodeURIComponent(foo));

  const { [complexVCard]: complexVCardObject } = vCardObject;
  t.true(_.isPlainObject(complexVCardObject));

  const [complexKey1, complexKey2] = fooComplex;
  const [complexValue1, complexValue2] = complex.split(';');

  t.true(complexKey1 in complexVCardObject);
  t.is(complexVCardObject[complexKey1], encodeURIComponent(complexValue1));

  t.true(complexKey2 in complexVCardObject);
  t.is(complexVCardObject[complexKey2], complexValue2);

  t.true(Array.isArray(vCardObject[extAttrVCard]));

  vCardObject[extAttrVCard].forEach(({ id, value }) => {
    t.true(_.isString(id));
    t.true(_.isString(value));
  });
});

/* Error / Wrong input scenarios validations */

