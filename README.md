[![NPM info](https://nodei.co/npm/oniyi-vcard-parser.png?downloads=true)](https://nodei.co/npm/oniyi-vcard-parser.png?downloads=true)

[![dependencies](https://david-dm.org/benkroeger/oniyi-vcard-parser.png)](https://david-dm.org/benkroeger/oniyi-vcard-parser.png)

> A vcard to JSON and back parser

also has special handlers for so called extension attributes as well as "complexAttributes", where the value of a vCard field may contain multiple logical values (e.g address --> street, postal code, city)

## Install

```sh
$ npm install --save oniyi-vcard-parser
```


## Usage

```js
var VCardParser = require('oniyi-vcard-parser');

var vcard = new VCardParser({
	vCardToJSONAttributeMapping: {
		'UID': 'uid',
    'ADR;WORK': 'workLocation',
    'AGENT;VALUE=X_PROFILE_UID': false,
    'CATEGORIES': 'tags'
	}
});

var vcardObject = vcard.toObject("my vcard string here");

var vCardString = vcard.toVcard(vcardObject);

```

## Changelog

0.1.0:
	* removed "debug" dependency
	* removed defaultmappings that were specific for IBM Connections
	* exporting only a constructor now, no static class methods anymore

0.2.0:
	* added two-way parsing for IBM Connections Extension-Attributes

1.0.0:
  * changed extattr to be an array instead of a hash

## License

MIT © [Benjamin Kroeger]()


[npm-url]: https://npmjs.org/package/oniyi-vcard-parser
[npm-image]: https://badge.fury.io/js/oniyi-vcard-parser.svg
[daviddm-url]: https://david-dm.org/benkroeger/oniyi-vcard-parser.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/benkroeger/oniyi-vcard-parser
