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

import * as Crypto from 'crypto';
import * as Events from 'events';
import * as Net from 'net';
const RandomString = require("randomstring");
const RSA = require('node-rsa');
import * as ssocket_helpers from './helpers';
import * as ZLib from 'zlib';


const DEFAULT_MAX_PACKAGE_SIZE = 16777211;
const DEFAULT_RSA_KEY_SIZE = 512;

/**
 * The default (string) encoding.
 */
export const DEFAULT_ENCODING = 'utf8';
/**
 * The default size for a maximum data package.
 */
export const DefaultMaxPackageSize = DEFAULT_MAX_PACKAGE_SIZE;
/**
 * The default RSA key size.
 */
export const DefaultRSAKeySize = DEFAULT_RSA_KEY_SIZE;

/**
 * A compression result.
 */
export interface CompressionResult {
    /**
     * The compressed data (if available).
     */
    compressed?: Buffer;
    /**
     * The suggested data to use.
     */
    data: Buffer;
    /**
     * The error (if occurred).
     */
    error?: any;
    /**
     * Data is compressed or not.
     */
    isCompressed: boolean;
    /**
     * The original (uncompressed) data.
     */
    uncompressed: Buffer;
}

export type DataTransformer = (ctx: DataTransformerContext) => Buffer | PromiseLike<Buffer>

export interface DataTransformerContext {
    readonly data: Buffer;
    readonly direction: DataTransformerDirection;
}

export enum DataTransformerDirection {
    Transform = 1,
    Restore = 2,
}

/**
 * A listener callback.
 * 
 * @param {any} err The error (if occurred).
 * @param {SimpleSocket} [socket] The socket if no error ocurred.
 */
export type ListenCallback = (err: any, socket?: SimpleSocket) => void;

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

        this.setupEvents();
    }

    /**
     * Gets the symetric encryption algorithm.
     */
    public get algorithm(): string {
        return 'aes-256-ctr';
    }

    /**
     * Try compress data or not.
     */
    public compress = true;

    /**
     * A custom function that transformes data
     * before it is send or after it has been received.
     */
    public dataTransformer: DataTransformer;

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
     * Gets the maximum size for a package.
     * 
     * @return {number} The maximum package size.
     */
    public getMaxPackageSize(): number {
        let result = parseInt(ssocket_helpers.toStringSafe(this.maxPackageSize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(DefaultMaxPackageSize).trim());
        }
        if (isNaN(result)) {
            result = DEFAULT_MAX_PACKAGE_SIZE;
        }

        return result;
    }

    /**
     * Gets the size for a RSA key.
     * 
     * @return {number} The RSA key size.
     */
    protected getRSAKeySize(): number {
        let result = parseInt(ssocket_helpers.toStringSafe(this.rsaKeySize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(DefaultRSAKeySize).trim());
        }
        if (isNaN(result)) {
            result = DEFAULT_RSA_KEY_SIZE;
        }

        return result;
    }

    /**
     * A custom function that transforms the handshake
     * public key before it is send or after it has been received.
     */
    public handshakeTransformer: DataTransformer;

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
                    keySize = me.getRSAKeySize();
                }

                me.emit('rsakey.generating', keySize);

                let keys = RSA({
                    b: keySize,
                });

                me.emit('rsakey.generated', keys);

                let untransformerPublicKey = new Buffer(ssocket_helpers.toStringSafe(keys.exportKey('public')),
                                                        me.getEncoding());

                let transformerPromise = asDataTransformerPromise(me.handshakeTransformer,
                                                                  DataTransformerDirection.Transform,
                                                                  untransformerPublicKey);

                transformerPromise.then((publicKey) => {
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
     * Makes a handshake if needed.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    public makeHandshakeIfNeeded(): PromiseLike<Buffer> {
        let me = this;

        return new Promise<Buffer>((resolve, reject) => {
            let type = me.type;
            
            if (ssocket_helpers.isNullOrUndefined(me.password)) {
                if (type == SocketType.Server) {
                    // SERVER handshake

                    me.makeServerHandshake().then((pwd) => {
                        me.password = pwd;

                        me.emit('handshake', pwd);

                        resolve(pwd);
                    }, (err) => {
                        reject(err);
                    });
                }
                else if (type == SocketType.Client) {
                    // CLIENT handshake
                    
                    me.makeClientHandshake().then((pwd) => {
                        me.password = pwd;

                        me.emit('handshake', pwd);
                        
                        resolve(pwd);
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
                resolve(me.password);
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
                                let transformerPromise = asDataTransformerPromise(me.handshakeTransformer,
                                                                                  DataTransformerDirection.Restore,
                                                                                  buff);

                                transformerPromise.then((untransformedBuffer) => {
                                    try {
                                        let publicKey = untransformedBuffer.toString(me.getEncoding());
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
     * Defines the maximum size of a package.
     */
    public maxPackageSize = DefaultMaxPackageSize;

    /**
     * Stores the current password.
     */
    public password: Buffer;

    /**
     * Defines a custom logic to generate a password (for the connection).
     */
    public passwordGenerator: () => Buffer | PromiseLike<Buffer> | string | PromiseLike<string>;

    /**
     * Reads data from the remote.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    public read(): PromiseLike<Buffer> {
        let me = this;

        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                me.makeHandshakeIfNeeded().then((pwd) => {
                    try {
                        ssocket_helpers.readSocket(me.socket, 4).then((buff) => {
                            try {
                                let dataLength = buff.readUInt32LE(0);
                                if (dataLength <= me.getMaxPackageSize()) {
                                    if (dataLength < 1) {
                                        completed(null, Buffer.alloc(0));
                                    }
                                    else {
                                        ssocket_helpers.readSocket(me.socket, dataLength).then((cryptedData) => {
                                            try {
                                                let decipher = Crypto.createDecipher(me.algorithm, pwd);

                                                let a = decipher.update(cryptedData);
                                                let b = decipher.final();

                                                let uncryptedData = Buffer.concat([a, b]);

                                                let isCompressed = 1 === uncryptedData.readUInt8(0);

                                                let compressedData = Buffer.alloc(uncryptedData.length - 1);
                                                uncryptedData.copy(compressedData, 0, 1);

                                                let untransformData = (transformedData: Buffer) => {
                                                    let transformerPromise = asDataTransformerPromise(me.dataTransformer,
                                                                                                      DataTransformerDirection.Restore,
                                                                                                      transformedData);

                                                    transformerPromise.then((untransformedData) => {
                                                        completed(null, transformedData);
                                                    }, (err) => {
                                                        completed(err);
                                                    });
                                                };

                                                if (isCompressed) {
                                                    ZLib.gunzip(compressedData, (err, uncompressedData) => {
                                                        if (err) {
                                                            completed(err);
                                                        }
                                                        else {
                                                            untransformData(uncompressedData);
                                                        }
                                                    });
                                                }
                                                else {
                                                    // not compressed
                                                    untransformData(compressedData);
                                                }
                                            }
                                            catch (e) {
                                                completed(e);
                                            }
                                        }, (err) => {
                                            completed(err);
                                        });
                                    }
                                }
                                else {
                                    completed(null, null);  // maximum reached
                                }
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
     * Reads data as JSON object.
     * 
     * @return {PromiseLike<T>} The promise.
     */
    public readJSON<T>(): PromiseLike<T> {
        let me = this;
        
        return new Promise<T>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                me.readString().then((json) => {
                    try {
                        let obj: T;

                        if (ssocket_helpers.isNullOrUndefined(json)) {
                            obj = <any>json;
                        }
                        else {
                            obj = JSON.parse(json);
                        }

                        completed(null, obj);
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
     * Reads data as string.
     * 
     * @return {PromiseLike<string>} The promise.
     */
    public readString(): PromiseLike<string> {
        let me = this;
        
        return new Promise<string>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                me.read().then((buff) => {
                    try {
                        if (buff) {
                            completed(null, 
                                      buff.toString(me.getEncoding()));
                        }
                        else {
                            completed(null, null);
                        }
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
     * The RSA key size.
     */
    public rsaKeySize = DefaultRSAKeySize;

    /**
     * Sets up the events.
     */
    protected setupEvents() {
        let me = this;
        
        me.socket.on('error', (err) => {
            if (err) {
                me.emit('error',
                        err);
            }
        });

        me.socket.on('close', () => {
            me.emit('close');
        });
    }

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

    /**
     * Tries to compress data.
     * 
     * @param {any} data The data to compress.
     * 
     * @return {PromiseLike<CompressionResult>} The promise.
     */
    protected tryCompress(data: any): PromiseLike<CompressionResult> {
        let me = this;
        
        return new Promise<CompressionResult>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let uncompressedData = ssocket_helpers.asBuffer(data);

                let result: CompressionResult = {
                    data: uncompressedData,
                    isCompressed: false,
                    uncompressed: uncompressedData,
                };

                let returnResult = () => {
                    completed(null, result);
                };
                
                if (ssocket_helpers.isNullOrUndefined(uncompressedData)) {
                    returnResult();
                    return;
                }

                if (!ssocket_helpers.toBooleanSafe(me.compress, true)) {
                    returnResult();  // do not compress
                    return;
                }

                ZLib.gzip(uncompressedData, (err, compressedData) => {
                    if (err) {
                        result.error = err;
                    }
                    else {
                        result.compressed = compressedData;

                        if (compressedData.length < uncompressedData.length) {
                            result.data = result.compressed;
                            result.isCompressed = true;
                        }
                    }

                    returnResult();
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Reads data from the remote.
     * 
     * @param {PromiseLike<Buffer>} The promise.
     */
    public write(data: any): PromiseLike<Buffer> {
        let me = this;

        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            let noDataSend = () => {
                completed(null, null);
            };

            try {
                let sendData = (uncryptedData: Buffer) => {
                    if (!uncryptedData || uncryptedData.length < 1) {
                        noDataSend();
                        return;
                    }

                    me.tryCompress(uncryptedData).then((result) => {
                        me.makeHandshakeIfNeeded().then((pwd) => {
                            try {
                                let cipher = Crypto.createCipher(me.algorithm, pwd);

                                let isCompressed = Buffer.alloc(1);
                                isCompressed.writeUInt8(result.isCompressed ? 1 : 0, 0);

                                let a = cipher.update(Buffer.concat([ isCompressed,
                                                                    result.data ]));
                                let b = cipher.final();

                                let cryptedData = Buffer.concat([ a, b ]);

                                if (cryptedData.length < 1) {
                                    noDataSend();
                                    return;
                                }

                                if (cryptedData.length > me.getMaxPackageSize()) {
                                    completed(null, null);  // maximum package size reached
                                    return;
                                }

                                let dataLength = Buffer.alloc(4);
                                dataLength.writeUInt32LE(cryptedData.length, 0);

                                // first send data length
                                me.socket.write(dataLength, (err) => {
                                    if (err) {
                                        completed(err);
                                        return;
                                    }

                                    // now the crypted data
                                    me.socket.write(cryptedData, (err) => {
                                        if (err) {
                                            completed(err);
                                        }
                                        else {
                                            completed(null, uncryptedData);  // all send
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
                    }, (err) => {
                        completed(err);
                    });
                };

                let transformerPromise = asDataTransformerPromise(me.dataTransformer,
                                                                  DataTransformerDirection.Transform,
                                                                  ssocket_helpers.asBuffer(data));
                transformerPromise.then((transformedData) => {
                    sendData(transformedData);
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
     * Sends an object / value as JSON string.
     * 
     * @param {T} obj The object to send.
     * 
     * @returns {PromiseLike<Buffer>} The promise.
     */
    public writeJSON<T>(obj: T): PromiseLike<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let json: string;
                if (ssocket_helpers.isNullOrUndefined(obj)) {
                    json = <any>obj;
                }
                else {
                    json = JSON.stringify(obj);
                }

                me.write(json).then((buff) => {
                    completed(null, buff);
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }
}

/**
 * Connects to a remote (server).
 * 
 * @param {number} port The TCP port of the remote machine.
 * @param {string} host The host (address).
 * 
 * @return {PromiseLike<SimpleSocket>} The promise.
 */
export function connect(port: number, host?: string): PromiseLike<SimpleSocket> {
    return new Promise<SimpleSocket>((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let client = new Net.Socket();

            client.connect(port, host, (err) => {
                try {
                    if (err) {
                        completed(err);
                    }
                    else {
                        completed(null, createClient(client));    
                    }
                }
                catch (e) {
                    completed(e);
                }
            });
        }
        catch (e) {
            completed(e);
        }
    });
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

/**
 * Starts listening on a port.
 * 
 * @param {number} port The TCP port to listen on.
 * @param {ListenCallback} cb The listener callback.
 * 
 * @return {PromiseLike<Net.Server>} The promise.
 */
export function listen(port: number,
                       cb: ListenCallback): PromiseLike<Net.Server> {
    return new Promise<Net.Server>((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            let serverToClient: SimpleSocket;

            let server = Net.createServer((connectionWithClient) => {
                try {
                    if (cb) {
                        cb(null,
                           createServer(connectionWithClient));
                    }
                }
                catch (e) {
                    if (cb) {
                        cb(e);
                    }    
                }
            });

            let isListening = false;

            server.once('error', (err) => {
                if (!isListening && err) {
                    completed(err);
                }
            });

            server.on('listening', () => {
                isListening = true;

                completed(null, server);
            });

            server.listen(port);
        }
        catch (e) {
            completed(e);
        }
    });
}


function asDataTransformerPromise(transformer: DataTransformer, direction: DataTransformerDirection, data: Buffer): PromiseLike<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            transformer = toDataTransformerSave(transformer);
            let transformerCtx: DataTransformerContext = {
                data: data,
                direction: direction,
            };

            let transformerResult = transformer(transformerCtx);
            if ('function' === typeof transformerResult['then']) {
                let promise = <PromiseLike<Buffer>>transformerResult;

                promise.then((transformedData) => {
                    completed(null, transformedData);
                }, (err) => {
                    completed(err);
                });
            }
            else {
                completed(null, <Buffer>transformerResult);
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

function toDataTransformerSave(transformer: DataTransformer): DataTransformer {
    if (!transformer) {
        transformer = (ctx) => {
            return ctx.data;
        };
    }
    
    return transformer;
}
