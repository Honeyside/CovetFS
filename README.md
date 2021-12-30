# CovetFS - The Node.js File Vault [![npm][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/covetfs.svg
[npm-url]: https://www.npmjs.com/package/covetfs

CovetFS is a distributed file system for Node.js. It comes with a JWT-protected API, with 24-hours tokens for file access.

Support us on <a href="https://www.patreon.com/honeyside"><strong>Patreon</strong></a> to get priority updates on our development plan and <strong>voting power on new features</strong>.

## Installation

Add CovetFS to your project with yarn or npm:

```
yarn add covetfs
```

```
npm install covetfs
```

## Usage & Examples

You can spawn a server with:

```javascript
const covet = require('covetfs');

covet.init({
  name: 'my-server', // whatever you like
  key: 'secret', // very long random secret key that only you will know
  port: 26017, // server will listen on this port
  url: 'http://yourdomain.tld:26017', // will be used to build your url, you can use a reverse proxy here
})
```

To connect a client:

```javascript
const covet = require('./index');

covet.connect({
  url: 'http://localhost:27020', // replace with your server address (careful with http or https)
  key: 'REPLACE', // replace with the master access key that the server will console log on start
})
```

Add a file to the vault (client must be connected first):

```javascript
let result;

try {
  result = await covet.add({
    path: __dirname + '/MYFILE.JPEG', // replace with your file
    extra1: 'abc',
    extra2: '123', // extra fields
  });
} catch (e) {
  return console.log('could not add file');
}

console.log('add', result); // result.id is the id of the file
```

Get a file from the vault (client must be connected first):

```javascript
let result;

try {
  result = await covet.get(FILE_ID);
} catch (e) {
  return console.log('could not get file');
}

console.log('get', result); // result.url is the tokenized url for the file, valid for 24 hours
```

Remove a file from the vault (client must be connected first):

```javascript
let result;

try {
  result = await covet.remove(FILE_ID);
} catch (e) {
  return console.log('could not remove file');
}

console.log('remove', result);
```

## Contributing

Feel free to open an Issue or send us a direct message.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/Honeyside/CovetFS/tags). 

## Author

* **Honeyside** - [Honeyside](https://github.com/Honeyside)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
