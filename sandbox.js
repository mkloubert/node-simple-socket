var net = require('net');
var simpleSocket = require('./lib');

var server = net.createServer((socket) => {
    var serverToClient = simpleSocket.createServer(socket);

    serverToClient.makeHandshakeIfNeeded().then((result) => {
        console.log('serverToClient.makeHandshakeIfNeeded(): ' + result);
    }, (err) => {
        console.log('[ERROR] serverToClient.makeHandshakeIfNeeded(): ' + err);
    });
});

server.on('listening', () => {
    console.log('Listening...');

    var client = new net.Socket();

    client.on('error', (err) => {
        console.log('[ERROR] client.1: ' + err);
    });

    client.connect(30904, (err) => {
        if (err) {
            console.log('[ERROR] client.2: ' + err);
        }
        else {
            var clientToServer = simpleSocket.createClient(client); 

            clientToServer.makeHandshakeIfNeeded().then((result) => {
                console.log('clientToServer.makeHandshakeIfNeeded(): ' + result);
            }, (err) => {
                console.log('[ERROR] clientToServer.makeHandshakeIfNeeded(): ' + err);
            });
        }
    });
});

server.listen(30904);

console.log('OK');
