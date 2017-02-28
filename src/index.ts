/// <reference types="node" />

// The MIT License (MIT)
// 
// node-simple-socket (https://github.com/mkloubert/node-simple-socket)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as Events from 'events';
import * as Net from 'net';
const RandomString = require("randomstring");
const RSA = require('node-rsa');
import * as ssocket_helpers from './helpers';


/**
 * The default (string) encoding.
 */
export const DEFAULT_ENCODING = 'utf8';
/**
 * The default RSA key size.
 */
export const DefaultRSAKeySize = 512;

/**
 * List of socket types.
 */
export enum SocketType {
    /**
     * Server
     */
    Server = 1,
    /**
     * Client
     */
    Client = 2,
}

/**
 * A "simple" socket.
 */
export class SimpleSocket extends Events.EventEmitter {
    /**
     * Stores the wrapped socket.
     */
    protected _socket: Net.Socket;
    /**
     * Stores the type.
     */
    protected _type: SocketType;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {Socket} type The type.
     * @param {Net.Socket} [socket] The "real" socket.
     */
    constructor(type: SocketType, socket?: Net.Socket) {
        super();

        this._type = type;
        if (isNaN(this._type)) {
            this._type = parseInt(ssocket_helpers.toStringSafe(type).trim());
        }

        this._socket = socket;
        if (!this._socket) {
            this._socket = new Net.Socket();
        }
    }

    /**
     * Disposes the socket.
     */
    public dispose() {
        let me = this;
        
        me.end().then(() => {
            me.emit('disposed');
        }, (err) => {
            me.emit('error', err);
        });
    }

    /**
     * Gets or sets the (string) encoding to use.
     */
    public encoding = DEFAULT_ENCODING;

    /**
     * Sends the connection.
     * 
     * @param {any} [data] The optional data to send.
     * @param {string} [encoding] The encoding to use.
     */
    public end(data?: any, encoding?: string): PromiseLike<any> {
        let me = this;

        let buff: Buffer;
        if (arguments.length > 0) {
            buff = ssocket_helpers.asBuffer(data, me.getEncoding());
        }
        
        return new Promise<any>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                if (!buff || buff.length < 1) {
                    me.socket.end();
                    completed();

                    return;
                }

                return this.socket.end(buff, (err) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        me.emit('close');

                        completed();
                    }
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Generates a password based on the 'passwordGenerator' property.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected generatePassword(): PromiseLike<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let pwdGen = me.passwordGenerator;
                if (!pwdGen) {
                    pwdGen = () => {
                        return new Buffer(RandomString.generate({
                            length: 48,
                            charset: 'alphanumeric',
                        }), me.getEncoding());
                    };
                }

                let returnPassword = (pwd: Buffer) => {
                    if (!pwd) {
                        pwd = Buffer.alloc(0);
                    }

                    completed(null, pwd);
                };

                let pwdResult = pwdGen();
                if ('object' === typeof pwdResult) {
                    if ('function' === typeof pwdResult['then']) {
                        // promise

                        let promise = <PromiseLike<any>>pwdResult;

                        promise.then((pwd) => {
                            returnPassword(ssocket_helpers.asBuffer(pwd));
                        }, (err) => {
                            completed(err);
                        });
                    }
                    else {
                        // Buffer
                        returnPassword(ssocket_helpers.asBuffer(pwdResult));
                    }
                }
                else {
                    // string
                    returnPassword(ssocket_helpers.asBuffer(pwdResult));
                }
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Returns the (string) encoding that should be used by that socket.
     * 
     * @return {string} The encoding.
     */
    protected getEncoding(): string {
        return ssocket_helpers.normalizeString(this.encoding) ||
               DEFAULT_ENCODING;
    }

    /**
     * Makes a CLIENT handshake.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected makeClientHandshake(): PromiseLike<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let keySize = parseInt(ssocket_helpers.toStringSafe(me.rsaKeySize).trim());
                if (isNaN(keySize)) {
                    keySize = 512;
                }

                let keys = RSA({
                    b: keySize,
                });

                let publicKey = new Buffer(ssocket_helpers.toStringSafe(keys.exportKey('public')),
                                           me.getEncoding());

                let publicKeyLength = Buffer.alloc(4);
                publicKeyLength.writeUInt32LE(publicKey.length, 0);

                // first send length of public key data
                me.socket.write(publicKeyLength, (err) => {
                    if (err) {
                        completed(err);
                        return;
                    }

                    // now send key
                    me.socket.write(publicKey, (err) => {
                        if (err) {
                            completed(err);
                            return;
                        }

                        // now lets wait for the password
                        // first the length
                        ssocket_helpers.readSocket(me.socket, 2).then((buff) => {
                            try {
                                let pwdLength = buff.readUInt16LE(0);
                                
                                // and now the password itself
                                ssocket_helpers.readSocket(me.socket, pwdLength).then((pwd) => {
                                    completed(null, pwd);
                                }, (err) => {
                                    completed(err);
                                });
                            }
                            catch (e) {
                                completed(e);
                            }
                        }, (err) => {
                            completed(err);
                        });
                    });
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Makes a handshake if needed.
     * 
     * @param {PromiseLike<boolean>} The promise.
     */
    public makeHandshakeIfNeeded(): PromiseLike<boolean> {
        let me = this;

        return new Promise<boolean>((resolve, reject) => {
            let type = me.type;
            
            if (ssocket_helpers.isNullOrUndefined(me.password)) {
                if (type == SocketType.Server) {
                    // SERVER handshake

                    me.makeServerHandshake().then((pwd) => {
                        me.password = pwd;

                        resolve(true);
                    }, (err) => {
                        reject(err);
                    });
                }
                else if (type == SocketType.Client) {
                    // CLIENT handshake
                    
                    me.makeClientHandshake().then((pwd) => {
                        me.password = pwd;
                        
                        resolve(true);
                    }, (err) => {
                        reject(err);
                    });
                }
                else {
                    reject(new Error(`Unknown socket type ${type}`));
                }
            }
            else {
                // no handshake required
                resolve(false);
            }
        });
    }

    /**
     * Makes a SERVER handshake.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected makeServerHandshake(): PromiseLike<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                // first read size of public key
                ssocket_helpers.readSocket(me.socket, 4).then((buff) => {
                    try {
                        let publicKeyLength = buff.readUInt32LE(0);

                        ssocket_helpers.readSocket(me.socket, publicKeyLength).then((buff) => {
                            try {
                                let publicKey = buff.toString(me.getEncoding());
                                let key = RSA(publicKey);

                                // generate and send password
                                me.generatePassword().then((pwd) => {
                                    try {
                                        let pwdLength = Buffer.alloc(2);
                                        pwdLength.writeUInt16LE(pwd.length, 0);

                                        // first send size of password
                                        me.socket.write(pwdLength, (err) => {
                                            if (err) {
                                                completed(err);
                                                return;
                                            }

                                            // and now the password itself
                                            me.socket.write(pwd, (err) => {
                                                if (err) {
                                                    completed(err);
                                                }
                                                else {
                                                    completed(null, pwd);
                                                }
                                            });
                                        });
                                    }
                                    catch (e) {
                                        completed(e);
                                    }
                                }, (err) => {
                                    completed(err);
                                });
                            }
                            catch (e) {
                                completed(e);
                            }
                        }, (err) => {
                            completed(err);
                        });
                    }
                    catch (e) {
                        completed(e);
                    }
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Stores the current password.
     */
    public password: Buffer;

    /**
     * Defines a custom logic to generate a password (for the connection).
     */
    public passwordGenerator: () => Buffer | PromiseLike<Buffer> | string | PromiseLike<string>;

    /**
     * The RSA key size.
     */
    public rsaKeySize = DefaultRSAKeySize;

    /**
     * Gets the wrapped socket.
     * 
     * @return {Net.Socket} The wrapped socket.
     */
    public get socket(): Net.Socket {
        return this._socket;
    }

    /**
     * Gets the socket type.
     */
    public get type(): SocketType {
        return this._type;
    }
}


/**
 * Creates a new instance.
 * 
 * @param {Net.Socket} [socket] The "real" socket.
 * @param {SocketType} [type] The type.
 * 
 * @return {SimpleSocket} The new instance.
 */
export function create(socket?: Net.Socket, type = SocketType.Client): SimpleSocket {
    return new SimpleSocket(type, socket);
}

/**
 * Creates a new CLIENT instance.
 * 
 * @param {Net.Socket} [socket] The "real" socket.
 * 
 * @return {SimpleSocket} The new instance.
 */
export function createClient(socket?: Net.Socket): SimpleSocket {
    return new SimpleSocket(SocketType.Client, socket);
}

/**
 * Creates a new SERVER instance.
 * 
 * @param {Net.Socket} [socket] The "real" socket.
 * 
 * @return {SimpleSocket} The new instance.
 */
export function createServer(socket?: Net.Socket): SimpleSocket {
    return new SimpleSocket(SocketType.Server, socket);
}
