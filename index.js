/// <reference types="node" />
"use strict";
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
const Crypto = require('crypto');
const Events = require('events');
const FS = require('fs');
const Net = require('net');
const Path = require('path');
const RSA = require('node-rsa');
const ssocket_helpers = require('./helpers');
const ZLib = require('zlib');
const DEFAULT_MAX_PACKAGE_SIZE = 16777211;
const DEFAULT_DEFAULT_READ_BUFFER_SIZE = 8192;
const DEFAULT_RSA_KEY_SIZE = 512;
/**
 * The default (string) encoding.
 */
exports.DEFAULT_ENCODING = 'utf8';
/**
 * Default working directory.
 */
exports.DefaultCWD = process.cwd();
/**
 * The default text encoding.
 */
exports.DefaultEncoding = 'utf8';
/**
 * The default size for a maximum data package.
 */
exports.DefaultMaxPackageSize = 16777211;
/**
 * Default buffer size for reading streams.
 */
exports.DefaultReadBufferSize = 8192;
/**
 * The default RSA key size.
 */
exports.DefaultRSAKeySize = 512;
/**
 * List of data transform directions.
 */
(function (DataTransformerDirection) {
    /**
     * Transform UNtransformed data.
     */
    DataTransformerDirection[DataTransformerDirection["Transform"] = 1] = "Transform";
    /**
     * Restore transformed data.
     */
    DataTransformerDirection[DataTransformerDirection["Restore"] = 2] = "Restore";
})(exports.DataTransformerDirection || (exports.DataTransformerDirection = {}));
var DataTransformerDirection = exports.DataTransformerDirection;
/**
 * List of socket types.
 */
(function (SocketType) {
    /**
     * Server
     */
    SocketType[SocketType["Server"] = 1] = "Server";
    /**
     * Client
     */
    SocketType[SocketType["Client"] = 2] = "Client";
})(exports.SocketType || (exports.SocketType = {}));
var SocketType = exports.SocketType;
/**
 * A "simple" socket.
 */
class SimpleSocket extends Events.EventEmitter {
    /**
     * Initializes a new instance of that class.
     *
     * @param {Socket} type The type.
     * @param {Net.Socket} [socket] The "real" socket.
     */
    constructor(type, socket) {
        super();
        /**
         * Try compress data or not.
         */
        this.compress = exports.Compress;
        /**
         * The path of the working directory.
         */
        this.cwd = exports.DefaultCWD;
        /**
         * A custom function that transformes data
         * before it is send or after it has been received.
         */
        this.dataTransformer = exports.DefaultDataTransformer;
        /**
         * Gets or sets the (string) encoding to use.
         */
        this.encoding = exports.DefaultEncoding;
        /**
         * A custom function that transforms the handshake
         * public key before it is send or after it has been received.
         */
        this.handshakeTransformer = exports.DefaultHandshakeTransformer;
        /**
         * Defines the maximum size of a package.
         */
        this.maxPackageSize = exports.DefaultMaxPackageSize;
        /**
         * Defines a custom logic to generate a password (for the connection).
         */
        this.passwordGenerator = exports.DefaultPasswordGenerator;
        /**
         * The default buffer size for reading a stream.
         */
        this.readBufferSize = exports.DefaultReadBufferSize;
        /**
         * The RSA key size.
         */
        this.rsaKeySize = exports.DefaultRSAKeySize;
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
    get algorithm() {
        return 'aes-256-ctr';
    }
    /**
     * Disposes the socket.
     */
    dispose() {
        let me = this;
        me.removeAllListeners();
        me.end().then(() => {
            me.emit('disposed');
        }, (err) => {
            me.emit('error', err);
        });
    }
    /**
     * Sends the connection.
     *
     * @param {any} [data] The optional data to send.
     * @param {string} [encoding] The encoding to use.
     *
     * @return {Promise<any>} The promise.
     */
    end(data, encoding) {
        let me = this;
        let buff;
        if (arguments.length > 0) {
            buff = ssocket_helpers.asBuffer(data, me.getEncoding());
        }
        return new Promise((resolve, reject) => {
            let completed = (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    me.emit('close');
                    resolve();
                }
            };
            try {
                if (!buff || buff.length < 1) {
                    me.socket.end();
                    completed(null);
                    return;
                }
                return this.socket.end(buff, (err) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        completed(null);
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
    generatePassword() {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                let pwdGen = me.passwordGenerator;
                if (!pwdGen) {
                    pwdGen = () => {
                        return new Promise((resolve, reject) => {
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
                let returnPassword = (pwd) => {
                    if (!pwd) {
                        pwd = Buffer.alloc(0);
                    }
                    completed(null, pwd);
                };
                let pwdResult = pwdGen();
                if ('object' === typeof pwdResult) {
                    if ('function' === typeof pwdResult['then']) {
                        // promise
                        let promise = pwdResult;
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
    getCwd() {
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
    getEncoding() {
        return ssocket_helpers.normalizeString(this.encoding) ||
            ssocket_helpers.normalizeString(exports.DefaultEncoding) ||
            exports.DEFAULT_ENCODING;
    }
    /**
     * Gets the maximum size for a package.
     *
     * @return {number} The maximum package size.
     */
    getMaxPackageSize() {
        let result = parseInt(ssocket_helpers.toStringSafe(this.maxPackageSize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(exports.DefaultMaxPackageSize).trim());
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
    getRSAKeySize() {
        let result = parseInt(ssocket_helpers.toStringSafe(this.rsaKeySize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(exports.DefaultRSAKeySize).trim());
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
    getReadBufferSize() {
        let result = parseInt(ssocket_helpers.toStringSafe(this.readBufferSize).trim());
        if (isNaN(result)) {
            result = parseInt(ssocket_helpers.toStringSafe(exports.DefaultReadBufferSize).trim());
        }
        if (isNaN(result)) {
            result = DEFAULT_DEFAULT_READ_BUFFER_SIZE;
        }
        return result;
    }
    /**
     * Makes a CLIENT handshake.
     *
     * @param {Promise<Buffer>} The promise.
     */
    makeClientHandshake() {
        let me = this;
        return new Promise((resolve, reject) => {
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
                let untransformerPublicKey = new Buffer(ssocket_helpers.toStringSafe(keys.exportKey('public')), me.getEncoding());
                let transformerPromise = asDataTransformerPromise(me.handshakeTransformer, DataTransformerDirection.Transform, untransformerPublicKey);
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
    makeHandshakeIfNeeded() {
        let me = this;
        return new Promise((resolve, reject) => {
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
    makeServerHandshake() {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                // first read size of public key
                ssocket_helpers.readSocket(me.socket, 4).then((buff) => {
                    try {
                        let publicKeyLength = buff.readUInt32LE(0);
                        if (publicKeyLength <= me.getMaxPackageSize()) {
                            ssocket_helpers.readSocket(me.socket, publicKeyLength).then((buff) => {
                                try {
                                    let transformerPromise = asDataTransformerPromise(me.handshakeTransformer, DataTransformerDirection.Restore, buff);
                                    transformerPromise.then((untransformedBuffer) => {
                                        try {
                                            let publicKey = untransformedBuffer.toString(me.getEncoding());
                                            let key = RSA(publicKey);
                                            me.emit('password.generating');
                                            // generate and send password
                                            me.generatePassword().then((pwd) => {
                                                try {
                                                    me.emit('password.generated', pwd);
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
     * Reads data from the remote.
     *
     * @param {Promise<Buffer>} The promise.
     */
    read() {
        let me = this;
        return new Promise((resolve, reject) => {
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
                                                let untransformData = (transformedData) => {
                                                    let transformerPromise = asDataTransformerPromise(me.dataTransformer, DataTransformerDirection.Restore, transformedData);
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
                                    completed(null, null); // maximum reached
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
     * Reads data from remote and writes it to a file on this machine.
     *
     * @param {string} path The path to the target file.
     * @param {string|number} [flags] The custom flags for opening the target file.
     *
     * @return {Promise<number>} The promise.
     */
    readFile(path, flags = 'w') {
        let me = this;
        if (!Path.isAbsolute(path)) {
            path = Path.join(me.getCwd(), path);
        }
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                FS.open(path, flags, (err, fdTarget) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        let closeFile = (err, bytesWritten) => {
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
    readJSON() {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                me.readString().then((json) => {
                    try {
                        let obj;
                        if (ssocket_helpers.isNullOrUndefined(json)) {
                            obj = json;
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
    readStream(fdTarget) {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                let bytesWritten = 0;
                let nextChunk;
                let sendAnswer = (err) => {
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
                                                me.emit('stream.read', fdTarget, chunk, written, hash);
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
                nextChunk(); // start reading chunks
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
    readString() {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                me.read().then((buff) => {
                    try {
                        if (buff) {
                            completed(null, buff.toString(me.getEncoding()));
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
     * Sets up the events.
     */
    setupEvents() {
        let me = this;
        me.socket.on('error', (err) => {
            if (err) {
                me.emit('error', err);
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
    get socket() {
        return this._socket;
    }
    /**
     * Gets the socket type.
     */
    get type() {
        return this._type;
    }
    /**
     * Tries to compress data.
     *
     * @param {any} data The data to compress.
     *
     * @return {Promise<CompressionResult>} The promise.
     */
    tryCompress(data) {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                let uncompressedData = ssocket_helpers.asBuffer(data);
                let result = {
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
                    returnResult(); // do not compress
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
    write(data) {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            let noDataSend = () => {
                completed(null, null);
            };
            try {
                let sendData = (uncryptedData) => {
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
                                let a = cipher.update(Buffer.concat([isCompressed,
                                    result.data]));
                                let b = cipher.final();
                                let cryptedData = Buffer.concat([a, b]);
                                if (cryptedData.length > me.getMaxPackageSize()) {
                                    completed(null, null); // maximum package size reached
                                    return;
                                }
                                let dataLength = Buffer.alloc(4);
                                dataLength.writeUInt32LE(cryptedData.length, 0);
                                // emit 'write.before'
                                me.emit('write.before', uncryptedData, isCompressed, dataLength, cryptedData);
                                let emitWriterAfterArgs = [];
                                let writeCompleted = (err, additionalArgs = []) => {
                                    // emit 'write.after'
                                    me.emit
                                        .apply(me, ['write.after', err, uncryptedData, isCompressed].concat(additionalArgs));
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
                                                writeCompleted(err, [dataLength]);
                                            }
                                            else {
                                                // all send
                                                writeCompleted(err, [dataLength, cryptedData]);
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
                let transformerPromise = asDataTransformerPromise(me.dataTransformer, DataTransformerDirection.Transform, ssocket_helpers.asBuffer(data));
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
    writeFile(path, maxSize, bufferSize, flags = 'r') {
        let me = this;
        if (!Path.isAbsolute(path)) {
            path = Path.join(me.getCwd(), path);
        }
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                FS.open(path, flags, (err, fdSrc) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        let closeFile = (err, bytesSend) => {
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
    writeJSON(obj) {
        let me = this;
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                let json;
                if (ssocket_helpers.isNullOrUndefined(obj)) {
                    json = obj;
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
    writeStream(fdSrc, maxSize, bufferSize) {
        let me = this;
        bufferSize = parseInt(ssocket_helpers.toStringSafe(bufferSize).trim());
        if (isNaN(bufferSize)) {
            bufferSize = me.getReadBufferSize();
        }
        maxSize = parseInt(ssocket_helpers.toStringSafe(maxSize).trim());
        return new Promise((resolve, reject) => {
            let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
            try {
                let remainingBytes = maxSize;
                let bytesCount = 0;
                let nextChunk;
                let sendChunk = (chunk) => {
                    try {
                        if (!chunk) {
                            chunk = Buffer.alloc(0);
                        }
                        // chunk size
                        let chunkLength = Buffer.alloc(4);
                        chunkLength.writeUInt32LE(chunk.length, 0);
                        let hash;
                        if (chunk.length > 0) {
                            hash = Crypto.createHash('sha256')
                                .update(chunk).digest();
                        }
                        else {
                            hash = Buffer.alloc(0); // we have no data to hash
                        }
                        // send to remote
                        me.write(Buffer.concat([chunkLength, hash, chunk])).then(() => {
                            me.emit('stream.write', fdSrc, remainingBytes, chunk, hash);
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
                                completed(null, bytesCount); // we have finished
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
                        let bytesToRead;
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
                                    let chunkToSend;
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
                            sendChunk(); // nothing more to send
                        }
                    }
                    catch (e) {
                        completed(e);
                    }
                };
                nextChunk(); // start sending chunks
            }
            catch (e) {
                completed(e);
            }
        });
    }
}
exports.SimpleSocket = SimpleSocket;
/**
 * Connects to a remote (server).
 *
 * @param {number} port The TCP port of the remote machine.
 * @param {string} host The host (address).
 *
 * @return {Promise<SimpleSocket>} The promise.
 */
function connect(port, host) {
    return new Promise((resolve, reject) => {
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
exports.connect = connect;
/**
 * Creates a new instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 * @param {SocketType} [type] The type.
 *
 * @return {SimpleSocket} The new instance.
 */
function create(socket, type = SocketType.Client) {
    return new SimpleSocket(type, socket);
}
exports.create = create;
/**
 * Creates a new CLIENT instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 *
 * @return {SimpleSocket} The new instance.
 */
function createClient(socket) {
    return new SimpleSocket(SocketType.Client, socket);
}
exports.createClient = createClient;
/**
 * Creates a new SERVER instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 *
 * @return {SimpleSocket} The new instance.
 */
function createServer(socket) {
    return new SimpleSocket(SocketType.Server, socket);
}
exports.createServer = createServer;
/**
 * Starts listening on a port.
 *
 * @param {number} port The TCP port to listen on.
 * @param {ListenCallback} cb The listener callback.
 *
 * @return {Promise<Net.Server>} The promise.
 */
function listen(port, cb) {
    return new Promise((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
        try {
            let serverToClient;
            let server = Net.createServer((connectionWithClient) => {
                try {
                    if (cb) {
                        cb(null, createServer(connectionWithClient));
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
exports.listen = listen;
function asDataTransformerPromise(transformer, direction, data) {
    return new Promise((resolve, reject) => {
        let completed = ssocket_helpers.createSimplePromiseCompletedAction(resolve, reject);
        try {
            transformer = toDataTransformerSave(transformer);
            let transformerCtx = {
                data: data,
                direction: direction,
            };
            let transformerResult = transformer(transformerCtx);
            if (ssocket_helpers.isNullOrUndefined(transformerResult)) {
                transformerResult = transformerCtx.data;
            }
            if ('function' === typeof transformerResult['then']) {
                let promise = transformerResult;
                promise.then((transformedData) => {
                    completed(null, transformedData);
                }, (err) => {
                    completed(err);
                });
            }
            else {
                completed(null, transformerResult);
            }
        }
        catch (e) {
            completed(e);
        }
    });
}
function toDataTransformerSave(transformer) {
    if (!transformer) {
        transformer = (ctx) => {
            return ctx.data;
        };
    }
    return transformer;
}
//# sourceMappingURL=index.js.map