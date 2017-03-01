/// <reference types="node" />
"use strict";
/**
 * Returns data as buffer.
 *
 * @param {any} data The input data.
 * @param {string} [encoding] The custom encoding to use if 'data' is NOT a buffer.
 *
 * @return {Buffer} The output data.
 */
function asBuffer(data, encoding) {
    let result = data;
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
exports.asBuffer = asBuffer;
/**
 * Creates a simple 'completed' callback for a promise.
 *
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 *
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
function createSimplePromiseCompletedAction(resolve, reject) {
    return (err, result) => {
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
exports.createSimplePromiseCompletedAction = createSimplePromiseCompletedAction;
/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is empty or not.
 */
function isEmptyString(val) {
    return '' === toStringSafe(val).trim();
}
exports.isEmptyString = isEmptyString;
/**
 * Checks if a value is (null) or (undefined).
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is (null)/(undefined) or not.
 */
function isNullOrUndefined(val) {
    return null === val ||
        'undefined' === typeof val;
}
exports.isNullOrUndefined = isNullOrUndefined;
/**
 * Normalizes a value as string so that is comparable.
 *
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 *
 * @return {string} The normalized value.
 */
function normalizeString(val, normalizer) {
    if (!normalizer) {
        normalizer = (str) => str.toLowerCase().trim();
    }
    return normalizer(toStringSafe(val));
}
exports.normalizeString = normalizeString;
/**
 * Reads a number of bytes from a socket.
 *
 * @param {net.Socket} socket The socket.
 * @param {Number} [numberOfBytes] The amount of bytes to read.
 *
 * @return {Promise<Buffer>} The promise.
 */
function readSocket(socket, numberOfBytes) {
    return new Promise((resolve, reject) => {
        let completed = createSimplePromiseCompletedAction(resolve, reject);
        try {
            let buff = socket.read(numberOfBytes);
            if (null === buff) {
                socket.once('readable', function () {
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
exports.readSocket = readSocket;
/**
 * Converts a value to a boolean.
 *
 * @param {any} val The value to convert.
 * @param {any} defaultValue The value to return if 'val' is (null) or (undefined).
 *
 * @return {boolean} The converted value.
 */
function toBooleanSafe(val, defaultValue = false) {
    if (isNullOrUndefined(val)) {
        return defaultValue;
    }
    return !!val;
}
exports.toBooleanSafe = toBooleanSafe;
/**
 * Converts a value to a string that is NOT (null) or (undefined).
 *
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 *
 * @return {string} The output value.
 */
function toStringSafe(str, defValue = '') {
    if (isNullOrUndefined(str)) {
        str = '';
    }
    str = '' + str;
    if ('' === str) {
        str = defValue;
    }
    return str;
}
exports.toStringSafe = toStringSafe;
//# sourceMappingURL=helpers.js.map