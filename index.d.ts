/// <reference types="node" />
import * as Events from 'events';
import * as Net from 'net';
/**
 * The default (string) encoding.
 */
export declare const DEFAULT_ENCODING: string;
/**
 * Default value that indicates if compression should be used or not.
 */
export declare let Compress: boolean;
/**
 * Default working directory.
 */
export declare let DefaultCWD: string;
/**
 * The default text encoding.
 */
export declare let DefaultEncoding: string;
/**
 * Default data transformer.
 */
export declare let DefaultDataTransformer: DataTransformer;
/**
 * Default handshake transformer.
 */
export declare let DefaultHandshakeTransformer: DataTransformer;
/**
 * The default size for a maximum data package.
 */
export declare let DefaultMaxPackageSize: number;
/**
 * Default buffer size for reading streams.
 */
export declare let DefaultReadBufferSize: number;
/**
 * The default RSA key size.
 */
export declare let DefaultRSAKeySize: number;
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
export declare type DataTransformer = (ctx: DataTransformerContext) => DataTransformerResult;
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
export declare enum DataTransformerDirection {
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
export declare type DataTransformerResult = Buffer | PromiseLike<Buffer>;
/**
 * A listener callback.
 *
 * @param {any} err The error (if occurred).
 * @param {SimpleSocket} [socket] The socket if no error ocurred.
 */
export declare type ListenCallback = (err: any, socket?: SimpleSocket) => void;
/**
 * List of socket types.
 */
export declare enum SocketType {
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
export declare class SimpleSocket extends Events.EventEmitter {
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
    constructor(type: SocketType, socket?: Net.Socket);
    /**
     * Gets the symetric encryption algorithm.
     */
    readonly algorithm: string;
    /**
     * Try compress data or not.
     */
    compress: boolean;
    /**
     * Gets the path of the working directory.
     */
    cwd: string;
    /**
     * A custom function that transformes data
     * before it is send or after it has been received.
     */
    dataTransformer: DataTransformer;
    /**
     * Disposes the socket.
     */
    dispose(): void;
    /**
     * Gets or sets the (string) encoding to use.
     */
    encoding: string;
    /**
     * Sends the connection.
     *
     * @param {any} [data] The optional data to send.
     * @param {string} [encoding] The encoding to use.
     */
    end(data?: any, encoding?: string): PromiseLike<any>;
    /**
     * Generates a password based on the 'passwordGenerator' property.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected generatePassword(): PromiseLike<Buffer>;
    /**
     * Returns the working directory.
     *
     * @return {string} The working directory.
     */
    protected getCwd(): string;
    /**
     * Returns the (string) encoding that should be used by that socket.
     *
     * @return {string} The encoding.
     */
    protected getEncoding(): string;
    /**
     * Gets the maximum size for a package.
     *
     * @return {number} The maximum package size.
     */
    getMaxPackageSize(): number;
    /**
     * Gets the size for a RSA key.
     *
     * @return {number} The RSA key size.
     */
    protected getRSAKeySize(): number;
    /**
     * Returns the buffer size for reading streams.
     *
     * @return {number} The buffer size.
     */
    protected getReadBufferSize(): number;
    /**
     * A custom function that transforms the handshake
     * public key before it is send or after it has been received.
     */
    handshakeTransformer: DataTransformer;
    /**
     * Makes a CLIENT handshake.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected makeClientHandshake(): PromiseLike<Buffer>;
    /**
     * Makes a handshake if needed.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    makeHandshakeIfNeeded(): PromiseLike<Buffer>;
    /**
     * Makes a SERVER handshake.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    protected makeServerHandshake(): PromiseLike<Buffer>;
    /**
     * Defines the maximum size of a package.
     */
    maxPackageSize: number;
    /**
     * Stores the current password.
     */
    password: Buffer;
    /**
     * Defines a custom logic to generate a password (for the connection).
     */
    passwordGenerator: () => Buffer | PromiseLike<Buffer> | string | PromiseLike<string>;
    /**
     * Reads data from the remote.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    read(): PromiseLike<Buffer>;
    /**
     * The default buffer size for reading a stream.
     */
    readBufferSize: number;
    /**
     * Reads data from remote and writes it to a file on this machine.
     *
     * @param {string} path The path to the target file.
     * @param {string|number} [flags] The custom flags for opening the target file.
     *
     * @return {PromiseLike<number>} The promise.
     */
    readFile(path: string, flags?: string | number): Promise<number>;
    /**
     * Reads data as JSON object.
     *
     * @return {PromiseLike<T>} The promise.
     */
    readJSON<T>(): PromiseLike<T>;
    /**
     * Reads data from remote and writes it to a stream on this machine.
     *
     * @param {number} fdTarget The stream pointer of the target.
     *
     * @return {PromiseLike<number>} The promise.
     */
    readStream(fdTarget: number): PromiseLike<number>;
    /**
     * Reads data as string.
     *
     * @return {PromiseLike<string>} The promise.
     */
    readString(): PromiseLike<string>;
    /**
     * The RSA key size.
     */
    rsaKeySize: number;
    /**
     * Sets up the events.
     */
    protected setupEvents(): void;
    /**
     * Gets the wrapped socket.
     *
     * @return {Net.Socket} The wrapped socket.
     */
    readonly socket: Net.Socket;
    /**
     * Gets the socket type.
     */
    readonly type: SocketType;
    /**
     * Tries to compress data.
     *
     * @param {any} data The data to compress.
     *
     * @return {PromiseLike<CompressionResult>} The promise.
     */
    protected tryCompress(data: any): PromiseLike<CompressionResult>;
    /**
     * Reads data from the remote.
     *
     * @param {PromiseLike<Buffer>} The promise.
     */
    write(data: any): PromiseLike<Buffer>;
    /**
     * Sends the data of a file to the remote.
     *
     * @param {string} path The path of the file to send.
     * @param {number} [maxSize] The maximum number of bytes to send.
     * @param {number} [bufferSize] The custom buffer size for the read operation(s).
     * @param {string|number} [flags] The custom flags for opening the file.
     *
     * @return {PromiseLike<number>} The promise.
     */
    writeFile(path: string, maxSize?: number, bufferSize?: number, flags?: string | number): Promise<number>;
    /**
     * Sends an object / value as JSON string.
     *
     * @param {T} obj The object to send.
     *
     * @returns {PromiseLike<Buffer>} The promise.
     */
    writeJSON<T>(obj: T): PromiseLike<Buffer>;
    /**
     * Sends the data of a stream to the remote.
     *
     * @param {number} fdSrc The stream pointer from where to read.
     * @param {number} [maxSize] The maximum number of bytes to send.
     * @param {number} [bufferSize] The custom buffer size for the read operation(s).
     *
     * @return {PromiseLike<number>} The promise.
     */
    writeStream(fdSrc: number, maxSize?: number, bufferSize?: number): PromiseLike<number>;
}
/**
 * Connects to a remote (server).
 *
 * @param {number} port The TCP port of the remote machine.
 * @param {string} host The host (address).
 *
 * @return {PromiseLike<SimpleSocket>} The promise.
 */
export declare function connect(port: number, host?: string): PromiseLike<SimpleSocket>;
/**
 * Creates a new instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 * @param {SocketType} [type] The type.
 *
 * @return {SimpleSocket} The new instance.
 */
export declare function create(socket?: Net.Socket, type?: SocketType): SimpleSocket;
/**
 * Creates a new CLIENT instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 *
 * @return {SimpleSocket} The new instance.
 */
export declare function createClient(socket?: Net.Socket): SimpleSocket;
/**
 * Creates a new SERVER instance.
 *
 * @param {Net.Socket} [socket] The "real" socket.
 *
 * @return {SimpleSocket} The new instance.
 */
export declare function createServer(socket?: Net.Socket): SimpleSocket;
/**
 * Starts listening on a port.
 *
 * @param {number} port The TCP port to listen on.
 * @param {ListenCallback} cb The listener callback.
 *
 * @return {PromiseLike<Net.Server>} The promise.
 */
export declare function listen(port: number, cb: ListenCallback): PromiseLike<Net.Server>;
