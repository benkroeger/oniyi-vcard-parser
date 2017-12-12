// node core modules

// 3rd party modules
const test = require('ava');
const _ = require('lodash');

// internal modules
const { initContext } = require('./fixtures');

test.beforeEach(initContext);

/* Successful scenarios validations */

let vCardObject = {};

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
        complexAttr,
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
    `complexVCard:${complex}`,
    'END:VCARD',
  ].join('\n');

  vCardObject = vCard.toObject(vCardString);

  ['fooJson', 'fooBarJson', 'extattr', 'complexAttr'].forEach(item => t.true(item in vCardObject));
  t.is(vCardObject[fooVCard], foo);
  t.is(vCardObject[fooBarVCard], fooBar);

  const { [complexVCard]: complexVCardObject } = vCardObject;
  t.true(_.isPlainObject(complexVCardObject));

  const [complexKey1, complexKey2] = complexAttr;
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
        complexAttr,
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

  const vCardObject = vCard.toObject(vCardString, true); // eslint-disable-line no-shadow
  ['fooJson', 'extattr', 'complexAttr'].forEach(item => t.true(item in vCardObject));
  t.is(vCardObject[fooVCard], encodeURIComponent(foo));

  const { [complexVCard]: complexVCardObject } = vCardObject;
  t.true(_.isPlainObject(complexVCardObject));

  const [complexKey1, complexKey2] = complexAttr;
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

test('validate toVCard() method', (t) => {
  const { vCard } = t.context;
  const {
    extattr,
    fooJson,
    fooBarJson,
    complexAttr,
  } = vCardObject;
  const [textObj, dateObj, numberObj] = extattr;

  const vCardStr = vCard.toVcard(vCardObject);

  const vCardArray = vCardStr.split('\n');
  const [, , textExt, dateExt, numberExt, fooStr, fooBarStr, complexStr] = vCardArray;
  t.true(textExt.includes(textObj.id));
  t.true(textExt.includes(textObj.value));

  t.true(dateExt.includes(dateObj.id));
  t.true(dateExt.includes(dateObj.value));

  t.true(numberExt.includes(numberObj.id));
  t.true(numberExt.includes(numberObj.value));

  t.is(fooStr.split(':')[1], fooJson);
  t.is(fooBarStr.split(':')[1], fooBarJson);
  t.is(complexStr.split(':')[1], _.map(complexAttr, value => value).join(';'));
});

/* Error / Wrong input scenarios validations */

