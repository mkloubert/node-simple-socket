var fs = require('fs');
var simpleSocket = require('./lib');

var port = 30904;

var server;
server = simpleSocket.listen(port, (err, serverToClient) => {
    serverToClient.readFile('./testfile.out.txt').then(() => {

    }, (err) => {

    });
}).then((srv) => {
    console.log('Listening on port ' + port);

    var client = simpleSocket.connect(port).then((clientToServer) => {
        clientToServer.writeFile('./testfile.txt', 15).then(() => {

        }, (err) => {

        });
    }, (err) => {
        console.log('[ERROR] Could not connect to port ' + port + ': ' + err);
    });
}, (err) => {
    console.log('[ERROR] Could not listen on port ' + port + ': ' + err);
});

console.log('OK');
