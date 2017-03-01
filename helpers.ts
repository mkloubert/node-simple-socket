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

import * as Net from 'net';


/**
 * Describes a simple 'completed' action.
 * 
 * @param {any} [err] The occurred error.
 * @param {TResult} [result] The result.
 */
export type SimpleCompletedAction<TResult> = (err?: any, result?: TResult) => void;


/**
 * Returns data as buffer.
 * 
 * @param {any} data The input data.
 * @param {string} [encoding] The custom encoding to use if 'data' is NOT a buffer.
 * 
 * @return {Buffer} The output data.
 */
export function asBuffer(data: any, encoding?: string): Buffer {
    let result: Buffer = data;
    if (!isNullOrUndefined(result)) {
        if ('object' !== typeof result) {
            // handle as string

            encoding = normalizeString(encoding);
            if (!encoding) {
                encoding = 'utf8';
            }

            result = new Buffer(toStringSafe(result), encoding);
        }
    }

    return result;
}

/**
 * Creates a simple 'completed' callback for a promise.
 * 
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 * 
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export function createSimplePromiseCompletedAction<TResult>(resolve: (value?: TResult | PromiseLike<TResult>) => void,
                                                            reject?: (reason: any) => void): SimpleCompletedAction<TResult> {
    return (err?, result?) => {
        if (err) {
            if (reject) {
                reject(err);
            }
        }
        else {
            if (resolve) {
                resolve(result);
            }
        }
    };
}

/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is empty or not.
 */
export function isEmptyString(val: any): boolean {
    return '' === toStringSafe(val).trim();
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return null === val ||
           'undefined' === typeof val;
}

/**
 * Normalizes a value as string so that is comparable.
 * 
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 * 
 * @return {string} The normalized value.
 */
export function normalizeString(val: any, normalizer?: (str: string) => string): string {
    if (!normalizer) {
        normalizer = (str) => str.toLowerCase().trim();
    }

    return normalizer(toStringSafe(val));
}

/**
 * Reads a number of bytes from a socket.
 * 
 * @param {net.Socket} socket The socket.
 * @param {Number} [numberOfBytes] The amount of bytes to read.
 * 
 * @return {Promise<Buffer>} The promise.
 */
export function readSocket(socket: Net.Socket, numberOfBytes?: number): PromiseLike<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);

        try {
            let buff: Buffer = socket.read(numberOfBytes);
            if (null === buff) {
                socket.once('readable', function() {
                    readSocket(socket, numberOfBytes).then((b) => {
                        completed(null, b);
                    }, (err) => {
                        completed(err);
                    });
                });
            }
            else {
                completed(null, buff);
            }
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Converts a value to a boolean.
 * 
 * @param {any} val The value to convert.
 * @param {any} defaultValue The value to return if 'val' is (null) or (undefined).
 * 
 * @return {boolean} The converted value.
 */
export function toBooleanSafe(val: any, defaultValue: any = false): boolean {
    if (isNullOrUndefined(val)) {
        return defaultValue;
    }

    return !!val;
}

/**
 * Converts a value to a string that is NOT (null) or (undefined).
 * 
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 * 
 * @return {string} The output value.
 */
export function toStringSafe(str: any, defValue: any = ''): string {
    if (isNullOrUndefined(str)) {
        str = '';
    }
    str = '' + str;
    if ('' === str) {
        str = defValue;
    }

    return str;
}
