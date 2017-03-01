var simpleSocket = require('./lib');

var port = 30904;

var server;
server = simpleSocket.listen(port, (err, serverToClient) => {
    serverToClient.readJSON().then((str) => {
        console.log('serverToClient.readJSON(): ' + JSON.stringify(str));
    }, (err) => {
        console.log('[ERROR] serverToClient.readJSON(): ' + err);
    });
}).then((srv) => {
    console.log('Listening on port ' + port);

    var client = simpleSocket.connect(port).then((clientToServer) => {
        clientToServer.writeJSON([ 'Coolio!' ]).then((result) => {
            console.log('clientToServer.writeJSON(): ' + result);
        }, (err) => {
            console.log('[ERROR] clientToServer.writeJSON(): ' + err);
        });
    }, (err) => {
        console.log('[ERROR] Could not connect to port ' + port + ': ' + err);
    });
}, (err) => {
    console.log('[ERROR] Could not listen on port ' + port + ': ' + err);
});

console.log('OK');
