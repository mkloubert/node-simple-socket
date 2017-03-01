# node-simple-socket

[![npm](https://img.shields.io/npm/v/node-simple-socket.svg)](https://www.npmjs.com/package/node-simple-socket)
[![npm](https://img.shields.io/npm/dt/node-simple-socket.svg?label=npm%20downloads)](https://www.npmjs.com/package/node-simple-socket)

Wrapper for [Node.js sockets](https://nodejs.org/api/net.html#net_class_net_socket) that makes it easy to send data compressed and crypted ([RSA](https://en.wikipedia.org/wiki/RSA_(cryptosystem)) / [AES](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)).

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=MMUUNRQ8ZUJEN) [![](https://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=o62pkd&url=https%3A%2F%2Fgithub.com%2Fmkloubert%2Fnode-simple-socket)

## How does it work?

Sockets are wrapped by a [class](https://mkloubert.github.io/node-simple-socket/classes/_index_.simplesocket.html) that exchanges data between two endpoints by encrypting and compressing it.

You do not need to setup anything for the encryption and compression ... you only need to start a server and connect with a client by using the new class(es)!

The new "sockets" make a handshake and share a (strong) random password, which is used for the "live" communication, with the help of RSA in the background.
This is done at the time, you start to send and receive data.

## Install

```bash
npm install simple-socket --save
```

## Usage

### Import

```javascript
var simpleSocket = require('simple-socket');
```

The [TypeScript](https://www.typescriptlang.org/) way:

```typescript
import * as simpleSocket from 'simple-socket';
```

### Create a server

```javascript
// listening for new connections
// on port 5979
simpleSocket.listen(5979, function(err, serverToClientSocket) {
    // callback for new connections

    if (err) {
        // an error occurred while creating
        // the client connection
    }
    else {
        // work with new connection
    }
}).then(function(server) {
    // the server is now listening
}, function(err) {
    // could not listening on port
});
```

### Connect to a server

```javascript
// listening for new connection
// on port 5979
simpleSocket.connect(5979, 'server.example.com').then(function(clientToServerSocket) {
    // connection established
}, function(err) {
    // could not connect
});
```

### Send and receive data

#### Raw data

Send:

```javascript
var dataToSend = new Buffer('Hello, TM!', 'utf8');

senderSocket.write(dataToSend).then(function(sendData) {
    // data has been send
}, function(err) {
    // could not send data
});
```

Receive:

```javascript
recipientSocket.read().then(function(receivedData) {
    // data has been arrived
}, function(err) {
    // could not receive data
});
```

#### Strings

Send:

```javascript
senderSocket.write('Hello, MK!').then(function(sendData) {
    // string has been send
}, function(err) {
    // could not send string
});
```

Receive:

```javascript
recipientSocket.readString().then(function(str) {
    // str === "Hello, MK!"
}, function(err) {
    // could not receive string
});
```

#### JSON objects

Send:

```javascript
var myObject = {
    TM: 5979,
    MK: '23979',
    PZSUX: true
};

senderSocket.writeJSON(myObject).then(function(sendData) {
    // object has been send
}, function (err) {
    // could not send object
});
```

Receive:

```javascript
recipientSocket.readJSON().then(function(obj) {
    // obj.TM === 5979
    // obj.MK === '23979'
    // obj.PZSUX === true
}, function(err) {
    // could not receive object
});
```

#### Files

Send:

```javascript
senderSocket.writeFile('./fileToSend.txt').then(function(numberOfBytesSend) {
    // file has been send
}, function (err) {
    // could not send file
});
```

Receive:

```javascript
recipientSocket.readFile('./whereToWriteReceivedFileTo.txt').then(function(numberOfBytesLoaded) {
    // file has been received
}, function (err) {
    // could not receive file
});
```

#### Streams

Send:

```javascript
var fs = require('fs');

fs.open('./fileToSend.txt', 'r', function(err, fd) {
    if (err) 
        // could not open stream
    }
    else {
        senderSocket.writeStream(fd).then(function(numberOfBytesSend) {
            // stream has been send
        }, function (err) {
            // could not send stream
        });
    }
});
```

Receive:

```javascript
var fs = require('fs');

fs.open('./whereToWriteReceivedFileTo.txt', 'w', function(err, fd) {
    if (err) {
        // could not open stream
    }
    else {
        recipientSocket.readStream(fd).then(function(numberOfBytesLoaded) {
            // stream has been received
        }, function (e) {
            // could not receive stream
        });
    }
});
```

#### Mixed (files <=> stream)

##### File => Stream

Send:

```javascript
senderSocket.writeFile('./fileToSend.txt').then(function(numberOfBytesSend) {
    // file has been send
}, function (err) {
    // could not send file
});
```

Receive:

```javascript
var fs = require('fs');

fs.open('./whereToWriteReceivedFileTo.txt', 'w', function(err, fd) {
    if (err) {
        // could not open stream
    }
    else {
        recipientSocket.readStream(fd).then(function(numberOfBytesLoaded) {
            // stream has been received
        }, function (e) {
            // could not receive stream
        });
    }
});
```

##### Stream => File

Send:

```javascript
var fs = require('fs');

fs.open('./fileToSend.txt', 'r', function(err, fd) {
    if (err) 
        // could not open stream
    }
    else {
        senderSocket.writeStream(fd).then(function(numberOfBytesSend) {
            // stream has been send
        }, function (err) {
            // could not send stream
        });
    }
});
```

```javascript
recipientSocket.readFile('./whereToWriteReceivedFileTo.txt').then(function(numberOfBytesLoaded) {
    // file has been received
}, function (err) {
    // could not receive file
});
```

### Events

```javascript
socket.on('close', function() {
    // socket closed
});

socket.on('disposed', function() {
    // socket has been disposed
});

socket.on('error', function(err) {
    // an error occurred
});

socket.on('handshake', function(pwd) {
    // socket has made a handshake
});

socket.on('rsakey.generating', function(keySize) {
    // socket is generting a RSA key pair
});

socket.on('rsakey.generated', function(keyPair) {
    // socket has been generted a RSA key pair
});
```

### Settings

#### RSA

A RSA key pair is generated by [node-rsa](https://www.npmjs.com/package/node-rsa) module on the client side.

The default key size for a handshake is `512`.

You can change this, by setting the `rsaKeySize` property:

```javascript
clientSocket.rsaKeySize = 2048;  // better, but takes more time
```

#### Custom password generator

While a handshake, (server) sockets generate a random password via [randomstring](https://www.npmjs.com/package/randomstring) module, that is exchanged with RSA encryption.

Those passwords have a size of `48` bytes and contain alphanumeric characters by default.

Passwords are used for the `aes-256-ctr` algorithm of the [crypto](https://nodejs.org/api/crypto.html) module, which encrypts and decrypts all data of the "live" communication.

You can define a custom password generator by setting the `passwordGenerator` property:

```javascript
serverSocket.passwordGenerator = function() {
    // generate a password as
    // buffer or string
    // 
    // you can return it directly
    // or as promise, if you work async
};
```

#### Maximum data (package) size

By default, you cannot send and receive data with more than `16777211` bytes.

You can change this, by setting the `maxPackageSize` property:

```javascript
socket.maxPackageSize = 597923979;
```

#### Default values

The module provides the following (public) variables that store default settings for properties of [SimpleSocket](https://mkloubert.github.io/node-simple-socket/classes/_index_.simplesocket.html) class.

```javascript
// initial value for 'compress' property
// Default: (undefined)
simpleSocket.Compress = true;

// initial value for 'cwd' property
// Default: process.cwd()
simpleSocket.DefaultCWD = 'E:/test';

// initial value for 'maxPackageSize' property
// Default: 16777211
simpleSocket.DefaultMaxPackageSize = 239795979;

// initial value for 'readBufferSize' property
// Default: 8192
simpleSocket.DefaultReadBufferSize = 10240;

// initial value for 'rsaKeySize' property
// Default: 512
simpleSocket.DefaultRSAKeySize = 4096;
```

## Documentation

The full API documentation can be found [here](https://mkloubert.github.io/node-simple-socket/).
