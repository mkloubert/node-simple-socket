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
import * as FS from 'fs';
import * as Net from 'net';
import * as Path from 'path';
const RSA = require('node-rsa');
import * as ssocket_helpers from './helpers';
import * as ZLib from 'zlib';


const DEFAULT_MAX_PACKAGE_SIZE = 16777211;
const DEFAULT_DEFAULT_READ_BUFFER_SIZE = 8192;
const DEFAULT_RSA_KEY_SIZE = 512;


/**
 * The default (string) encoding.
 */
export const DEFAULT_ENCODING = 'utf8';
/**
 * Default value that indicates if compression should be used or not.
 */
export let Compress: boolean;
/**
 * Default working directory.
 */
export let DefaultCWD = process.cwd();
/**
 * The default text encoding.
 */
export let DefaultEncoding = 'utf8';
/**
 * Default data transformer.
 */
export let DefaultDataTransformer: DataTransformer;
/**
 * Default handshake transformer.
 */
export let DefaultHandshakeTransformer: DataTransformer;
/**
 * The default size for a maximum data package.
 */
export let DefaultMaxPackageSize = 16777211;
/**
 * The default password generator.
 */
export let DefaultPasswordGenerator: PasswordGenerator;
/**
 * Default buffer size for reading streams.
 */
export let DefaultReadBufferSize = 8192;
/**
 * The default RSA key size.
 */
export let DefaultRSAKeySize = 512;


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

/**
 * A data transformer.
 * 
 * @param {DataTransformerContext} ctx The context.
 * 
 * @return {DataTransformerResult} The result.
 */
export type DataTransformer = (ctx: DataTransformerContext) => DataTransformerResult;

/**
 * A context for a data transformer.
 */
export interface DataTransformerContext {
    /**
     * The (source) data.
     */
    readonly data: Buffer;
    /**
     * The direction.
     */
    readonly direction: DataTransformerDirection;
}

/**
 * List of data transform directions.
 */
export enum DataTransformerDirection {
    /**
     * Transform UNtransformed data.
     */
    Transform = 1,
    /**
     * Restore transformed data.
     */
    Restore = 2,
}

/**
 * A result for of a data transformer.
 */
export type DataTransformerResult = Buffer | PromiseLike<Buffer>;

/**
 * A listener callback.
 * 
 * @param {any} err The error (if occurred).
 * @param {SimpleSocket} [socket] The socket if no error ocurred.
 */
export type ListenCallback = (err: any, socket?: SimpleSocket) => void;

/**
 * A password generator.
 * 
 * @return {PasswordGeneratorResult} The result.
 */
export type PasswordGenerator = () => PasswordGeneratorResult;

/**
 * The result of a password generator.
 */
export type PasswordGeneratorResult = Buffer | PromiseLike<Buffer> | string | PromiseLike<string>;

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
    public compress = Compress;

    /**
     * The path of the working directory.
     */
    public cwd = DefaultCWD;

    /**
     * A custom function that transformes data
     * before it is send or after it has been received.
     */
    public dataTransformer = DefaultDataTransformer;

    /**
     * Disposes the socket.
     */
    public dispose() {
        let me = this;

        me.removeAllListeners();
        
        me.end().then(() => {
            me.emit('disposed');
        }, (err) => {
            me.emit('error', err);
        });
    }

    /**
     * Gets or sets the (string) encoding to use.
     */
    public encoding = DefaultEncoding;

    /**
     * Sends the connection.
     * 
     * @param {any} [data] The optional data to send.
     * @param {string} [encoding] The encoding to use.
     * 
     * @return {Promise<any>} The promise.
     */
    public end(data?: any, encoding?: string): Promise<any> {
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
     * @param {Promise<Buffer>} The promise.
     */
    protected generatePassword(): Promise<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let pwdGen = me.passwordGenerator;
                if (!pwdGen) {
                    pwdGen = () => {
                        return new Promise<Buffer>((resolve, reject) => {
                            Crypto.randomBytes(48, (err, randBuff) => {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    resolve(randBuff);
                                }
                            });
                        });
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
     * Returns the working directory.
     * 
     * @return {string} The working directory.
     */
    protected getCwd(): string {
        let result = ssocket_helpers.toStringSafe(this.cwd);
        if (ssocket_helpers.isEmptyString(result)) {
            result = process.cwd();
        }
        else if (!Path.isAbsolute(result)) {
            result = Path.join(process.cwd(), result);
        }

        return result;
    }

    /**
     * Returns the (string) encoding that should be used by that socket.
     * 
     * @return {string} The encoding.
     */
    protected getEncoding(): string {
        return ssocket_helpers.normalizeString(this.encoding) ||
               ssocket_helpers.normalizeString(DefaultEncoding) ||
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
     * Returns the buffer size for reading streams.
     * 
     * @return {number} The buffer size.
     */
    protected getReadBufferSize(): number {
        let result = parseInt(ssocket_helpers.toStringSafe(this.readBufferSize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(DefaultReadBufferSize).trim());
        }
        if (isNaN(result)) {
            result = DEFAULT_DEFAULT_READ_BUFFER_SIZE;
        }

        return result;
    }

    /**
     * A custom function that transforms the handshake
     * public key before it is send or after it has been received.
     */
    public handshakeTransformer = DefaultHandshakeTransformer;

    /**
     * Makes a CLIENT handshake.
     * 
     * @param {Promise<Buffer>} The promise.
     */
    protected makeClientHandshake(): Promise<Buffer> {
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
                                    if (pwdLength <= me.getMaxPackageSize()) {
                                        // and now the password itself
                                        ssocket_helpers.readSocket(me.socket, pwdLength).then((pwd) => {
                                            completed(null, pwd);
                                        }, (err) => {
                                            completed(err);
                                        });
                                    }
                                    else {
                                        // maximum package size reached

                                        me.socket.end();
                                        completed(null, null);
                                    }
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
     * @param {Promise<Buffer>} The promise.
     */
    public makeHandshakeIfNeeded(): Promise<Buffer> {
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
     * @param {Promise<Buffer>} The promise.
     */
    protected makeServerHandshake(): Promise<Buffer> {
        let me = this;
        
        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                // first read size of public key
                ssocket_helpers.readSocket(me.socket, 4).then((buff) => {
                    try {
                        let publicKeyLength = buff.readUInt32LE(0);

                        if (publicKeyLength <= me.getMaxPackageSize()) {
                            ssocket_helpers.readSocket(me.socket, publicKeyLength).then((buff) => {
                                try {
                                    let transformerPromise = asDataTransformerPromise(me.handshakeTransformer,
                                                                                      DataTransformerDirection.Restore,
                                                                                      buff);

                                    transformerPromise.then((untransformedBuffer) => {
                                        try {
                                            let publicKey = untransformedBuffer.toString(me.getEncoding());
                                            let key = RSA(publicKey);

                                            me.emit('password.generating');

                                            // generate and send password
                                            me.generatePassword().then((pwd) => {
                                                try {
                                                    me.emit('password.generated',
                                                            pwd);

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
                        else {
                            // maximum package size reached

                            me.socket.end();
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
    public passwordGenerator = DefaultPasswordGenerator;

    /**
     * Reads data from the remote.
     * 
     * @param {Promise<Buffer>} The promise.
     */
    public read(): Promise<Buffer> {
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

                                                let isCompressed = uncryptedData.readUInt8(0) > 127;

                                                let compressedData = Buffer.alloc(uncryptedData.length - 1);
                                                uncryptedData.copy(compressedData, 0, 1);

                                                let untransformData = (transformedData: Buffer) => {
                                                    let transformerPromise = asDataTransformerPromise(me.dataTransformer,
                                                                                                      DataTransformerDirection.Restore,
                                                                                                      transformedData);

                                                    transformerPromise.then((untransformedData) => {
                                                        completed(null, untransformedData);
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
     * The default buffer size for reading a stream.
     */
    public readBufferSize = DefaultReadBufferSize;

    /**
     * Reads data from remote and writes it to a file on this machine.
     * 
     * @param {string} path The path to the target file.
     * @param {string|number} [flags] The custom flags for opening the target file.
     * 
     * @return {Promise<number>} The promise.
     */
    public readFile(path: string, flags: string | number = 'w'): Promise<number> {
        let me = this;

        if (!Path.isAbsolute(path)) {
            path = Path.join(me.getCwd(), path);
        }

        return new Promise<number>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                FS.open(path, flags, (err, fdTarget) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        let closeFile = (err: any, bytesWritten?: number) => {
                            FS.close(fdTarget, (e) => {
                                if (e) {
                                    completed(e, bytesWritten);
                                }
                                else {
                                    completed(err, bytesWritten);
                                }
                            });
                        };

                        me.readStream(fdTarget).then((bytesWritten) => {
                            closeFile(null, bytesWritten);
                        }, (err) => {
                            closeFile(err);
                        });
                    }
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
     * @return {Promise<T>} The promise.
     */
    public readJSON<T>(): Promise<T> {
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
     * Reads data from remote and writes it to a stream on this machine.
     * 
     * @param {number} fdTarget The stream pointer of the target.
     * 
     * @return {Promise<number>} The promise.
     */
    public readStream(fdTarget: number): Promise<number> {
        let me = this;

        return new Promise<number>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let bytesWritten = 0;

                let nextChunk: () => void;

                let sendAnswer = (err?: any) => {
                    let errMsg = ssocket_helpers.toStringSafe(err);
                    if (ssocket_helpers.isEmptyString(errMsg)) {
                        errMsg = '';
                    }

                    me.write(errMsg).then(() => {
                        if (errMsg) {
                            completed(err);
                        }
                        else {
                            nextChunk();
                        }
                    }, (err) => {
                        completed(err);
                    });
                };

                nextChunk = () => {
                    // check chunk block
                    me.read().then((chunkBlock) => {
                        try {
                            let chunkLength = chunkBlock.readUInt32LE(0);
                            if (chunkLength < 1) {
                                // no more data
                                completed(null, bytesWritten);
                            }
                            else {
                                if (chunkLength > me.getMaxPackageSize()) {
                                    // chunk is too big
                                    sendAnswer(new Error('Chunk is too big!'));
                                }
                                else {
                                    // write to stream

                                    let hash = Buffer.alloc(32);
                                    chunkBlock.copy(hash, 0, 4, 4 + hash.length);

                                    let chunk = Buffer.alloc(chunkLength);
                                    chunkBlock.copy(chunk, 0, 4 + hash.length);

                                    let realHash = Crypto.createHash('sha256')
                                                         .update(chunk).digest();

                                    if (hash.equals(realHash)) {
                                        FS.write(fdTarget, chunk, (err, written) => {
                                            if (!err) {
                                                if (written > 0) {
                                                    bytesWritten += written;
                                                }

                                                me.emit('stream.read',
                                                        fdTarget, chunk, written, hash);
                                            }

                                            sendAnswer(err);
                                        });
                                    }
                                    else {
                                        // unique hashes
                                        sendAnswer(new Error('Invalid chunk hash: ' + realHash.toString('hex')));
                                    }
                                }
                            }
                        }
                        catch (e) {
                            sendAnswer(e);
                        }
                    }, (err) => {
                        sendAnswer(err);
                    });
                };

                nextChunk();  // start reading chunks
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Reads data as string.
     * 
     * @return {Promise<string>} The promise.
     */
    public readString(): Promise<string> {
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
     * @return {Promise<CompressionResult>} The promise.
     */
    protected tryCompress(data: any): Promise<CompressionResult> {
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

                        if (compressedData.length < uncompressedData.length ||
                            ssocket_helpers.toBooleanSafe(me.compress)) {
                            // compressed data is smaller or
                            // compression is forced

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
     * @param {Promise<Buffer>} The promise.
     */
    public write(data: any): Promise<Buffer> {
        let me = this;

        return new Promise<Buffer>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            let noDataSend = () => {
                completed(null, null);
            };

            try {
                let sendData = (uncryptedData: Buffer) => {
                    if (!uncryptedData) {
                        noDataSend();
                        return;
                    }

                    me.tryCompress(uncryptedData).then((result) => {
                        me.makeHandshakeIfNeeded().then((pwd) => {
                            try {
                                let cipher = Crypto.createCipher(me.algorithm, pwd);

                                let n = Math.floor(Math.random() * 128);
                                if (n > 127) {
                                    n = 127;
                                }
                                else if (n < 0) {
                                    n = 0;
                                }

                                let isCompressed = Buffer.alloc(1);
                                isCompressed.writeUInt8(n + (result.isCompressed ? 128 : 0), 0);

                                let a = cipher.update(Buffer.concat([ isCompressed,
                                                                      result.data ]));
                                let b = cipher.final();

                                let cryptedData = Buffer.concat([ a, b ]);

                                if (cryptedData.length > me.getMaxPackageSize()) {
                                    completed(null, null);  // maximum package size reached
                                    return;
                                }

                                let dataLength = Buffer.alloc(4);
                                dataLength.writeUInt32LE(cryptedData.length, 0);

                                // emit 'write.before'
                                me.emit('write.before',
                                        uncryptedData, isCompressed, dataLength, cryptedData);

                                let emitWriterAfterArgs = [];
                                let writeCompleted = (err: any, additionalArgs = []) => {
                                    // emit 'write.after'
                                    me.emit
                                      .apply(me,
                                             [ 'write.after', err, uncryptedData, isCompressed ].concat(additionalArgs));

                                    if (err) {
                                        completed(err);
                                    }
                                    else {
                                        completed(null, uncryptedData);
                                    }
                                };

                                // first send data length
                                me.socket.write(dataLength, (err) => {
                                    if (err) {
                                        writeCompleted(err);
                                    }
                                    else {
                                        // now the crypted data

                                        me.socket.write(cryptedData, (err) => {
                                            if (err) {
                                                writeCompleted(err, [ dataLength ]);
                                            }
                                            else {
                                                // all send
                                                writeCompleted(err, [ dataLength, cryptedData ]);
                                            }
                                        });
                                    }
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
     * Sends the data of a file to the remote.
     * 
     * @param {string} path The path of the file to send.
     * @param {number} [maxSize] The maximum number of bytes to send.
     * @param {number} [bufferSize] The custom buffer size for the read operation(s).
     * @param {string|number} [flags] The custom flags for opening the file.
     * 
     * @return {Promise<number>} The promise.
     */
    public writeFile(path: string, maxSize?: number, bufferSize?: number, flags: string | number = 'r'): Promise<number> {
        let me = this;

        if (!Path.isAbsolute(path)) {
            path = Path.join(me.getCwd(), path);
        }

        return new Promise<number>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                FS.open(path, flags, (err, fdSrc) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        let closeFile = (err: any, bytesSend?: number) => {
                            FS.close(fdSrc, (e) => {
                                if (e) {
                                    completed(e, bytesSend);
                                }
                                else {
                                    completed(err, bytesSend);
                                }
                            });
                        };

                        me.writeStream(fdSrc, maxSize, bufferSize).then((bytesSend) => {
                            closeFile(null, bytesSend);
                        }, (err) => {
                            closeFile(err);
                        });
                    }
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
     * @returns {Promise<Buffer>} The promise.
     */
    public writeJSON<T>(obj: T): Promise<Buffer> {
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

    /**
     * Sends the data of a stream to the remote.
     * 
     * @param {number} fdSrc The stream pointer from where to read.
     * @param {number} [maxSize] The maximum number of bytes to send.
     * @param {number} [bufferSize] The custom buffer size for the read operation(s).
     * 
     * @return {Promise<number>} The promise.
     */
    public writeStream(fdSrc: number, maxSize?: number, bufferSize?: number): Promise<number> {
        let me = this;
        
        bufferSize = parseInt(ssocket_helpers.toStringSafe(bufferSize).trim());
        if (isNaN(bufferSize)) {
            bufferSize = me.getReadBufferSize();
        }

        maxSize = parseInt(ssocket_helpers.toStringSafe(maxSize).trim());

        return new Promise<number>((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let remainingBytes = maxSize;
                let bytesCount = 0;

                let nextChunk: () => void;

                let sendChunk = (chunk?: Buffer) => {
                    try {
                        if (!chunk) {
                            chunk = Buffer.alloc(0);
                        }

                        // chunk size
                        let chunkLength = Buffer.alloc(4);
                        chunkLength.writeUInt32LE(chunk.length, 0);

                        let hash: Buffer;
                        if (chunk.length > 0) {
                            hash = Crypto.createHash('sha256')
                                         .update(chunk).digest();
                        }
                        else {
                            hash = Buffer.alloc(0);  // we have no data to hash
                        }

                        // send to remote
                        me.write(Buffer.concat([ chunkLength, hash, chunk ])).then(() => {
                            me.emit('stream.write',
                                    fdSrc, remainingBytes, chunk, hash);

                            if (chunk.length > 0) {
                                // wait for answer
                                me.readString().then((errMsg) => {
                                    if (ssocket_helpers.isEmptyString(errMsg)) {
                                        nextChunk();
                                    }
                                    else {
                                        // error on remote side => abort
                                        completed(new Error('Remote error: ' + ssocket_helpers.toStringSafe(errMsg)));
                                    }
                                }, (err) => {
                                    completed(err);
                                });
                            }
                            else {
                                completed(null, bytesCount);  // we have finished
                            }
                        }, (err) => {
                            completed(err);
                        });
                    }
                    catch (e) {
                        completed(e);
                    }
                };

                nextChunk = () => {
                    try {
                        let buffer = Buffer.alloc(bufferSize);

                        let bytesToRead: number;
                        if (isNaN(remainingBytes)) {
                            bytesToRead = buffer.length;
                        }
                        else {
                            if (remainingBytes < 1) {
                                remainingBytes = 0;
                            }

                            bytesToRead = remainingBytes;
                            bytesToRead = Math.min(bytesToRead, buffer.length);
                        }

                        if (bytesToRead > 0) {
                            // read chunk
                            FS.read(fdSrc, buffer, 0, bytesToRead, null, (err, bytesRead) => {
                                try {
                                    let chunkToSend: Buffer;
                                    if (bytesRead > 0) {
                                        chunkToSend = Buffer.alloc(bytesRead);
                                        buffer.copy(chunkToSend, 0, 0, bytesRead);
                                    }
                                    else {
                                        chunkToSend = Buffer.alloc(0);
                                    }

                                    bytesCount += chunkToSend.length;
                                    remainingBytes -= chunkToSend.length;

                                    sendChunk(chunkToSend);
                                }
                                catch (e) {
                                    completed(e);
                                }
                            });
                        }
                        else {
                            sendChunk();  // nothing more to send
                        }
                    }
                    catch (e) {
                        completed(e);
                    }
                };

                nextChunk();  // start sending chunks
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
 * @return {Promise<SimpleSocket>} The promise.
 */
export function connect(port: number, host?: string): Promise<SimpleSocket> {
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
 * @return {Promise<Net.Server>} The promise.
 */
export function listen(port: number,
                       cb: ListenCallback): Promise<Net.Server> {
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


function asDataTransformerPromise(transformer: DataTransformer, direction: DataTransformerDirection, data: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);

        try {
            transformer = toDataTransformerSave(transformer);
            let transformerCtx: DataTransformerContext = {
                data: data,
                direction: direction,
            };

            let transformerResult = transformer(transformerCtx);
            if (ssocket_helpers.isNullOrUndefined(transformerResult)) {
                transformerResult = transformerCtx.data;
            }

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
