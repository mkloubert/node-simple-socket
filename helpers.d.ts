/// <reference types="node" />
import * as Net from 'net';
/**
 * Describes a simple 'completed' action.
 *
 * @param {any} [err] The occurred error.
 * @param {TResult} [result] The result.
 */
export declare type SimpleCompletedAction<TResult> = (err?: any, result?: TResult) => void;
/**
 * Returns data as buffer.
 *
 * @param {any} data The input data.
 * @param {string} [encoding] The custom encoding to use if 'data' is NOT a buffer.
 *
 * @return {Buffer} The output data.
 */
export declare function asBuffer(data: any, encoding?: string): Buffer;
/**
 * Creates a simple 'completed' callback for a promise.
 *
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 *
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export declare function createSimplePromiseCompletedAction<TResult>(resolve: (value?: TResult | PromiseLike<TResult>) => void, reject?: (reason: any) => void): SimpleCompletedAction<TResult>;
/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is empty or not.
 */
export declare function isEmptyString(val: any): boolean;
/**
 * Checks if a value is (null) or (undefined).
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is (null)/(undefined) or not.
 */
export declare function isNullOrUndefined(val: any): boolean;
/**
 * Normalizes a value as string so that is comparable.
 *
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 *
 * @return {string} The normalized value.
 */
export declare function normalizeString(val: any, normalizer?: (str: string) => string): string;
/**
 * Reads a number of bytes from a socket.
 *
 * @param {net.Socket} socket The socket.
 * @param {Number} [numberOfBytes] The amount of bytes to read.
 *
 * @return {Promise<Buffer>} The promise.
 */
export declare function readSocket(socket: Net.Socket, numberOfBytes?: number): Promise<Buffer>;
/**
 * Converts a value to a boolean.
 *
 * @param {any} val The value to convert.
 * @param {any} defaultValue The value to return if 'val' is (null) or (undefined).
 *
 * @return {boolean} The converted value.
 */
export declare function toBooleanSafe(val: any, defaultValue?: any): boolean;
/**
 * Converts a value to a string that is NOT (null) or (undefined).
 *
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 *
 * @return {string} The output value.
 */
export declare function toStringSafe(str: any, defValue?: any): string;
