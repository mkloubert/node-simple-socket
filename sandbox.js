var fs = require('fs');
var simpleSocket = require('./index');

var port = 30904;

var server;
server = simpleSocket.listen(port, (err, serverToClient) => {
    serverToClient.readFile('E:/VMs/_iso/linuxmint-16-cinnamon-dvd-32bit.out.iso').then(() => {
        if (1 == 2) {
                
        }
    }, (err) => {
        if (err) {

        }
    });
}).then((srv) => {
    console.log('Listening on port ' + port);

    var client = simpleSocket.connect(port).then((clientToServer) => {
        clientToServer.on('write.before', function() {
            if (arguments) {
                
            }
        });

        clientToServer.on('write.after', function() {
            if (arguments) {

            }
        });

        clientToServer.writeFile('E:/VMs/_iso/linuxmint-16-cinnamon-dvd-32bit.iso').then(() => {
            if (1 == 2) {

            }
        }, (err) => {
            if (err) {
            
            }
        });
    }, (err) => {
        console.log('[ERROR] Could not connect to port ' + port + ': ' + err);
    });
}, (err) => {
    console.log('[ERROR] Could not listen on port ' + port + ': ' + err);
});

console.log('OK');
