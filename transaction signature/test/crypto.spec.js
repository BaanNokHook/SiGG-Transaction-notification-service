"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const __1 = require("..");
const fixtures = require("./fixtures/crypto.json");
(0, mocha_1.describe)('crypto', () => {
    ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
        (0, mocha_1.describe)(algorithm, () => {
            fixtures.hashes.forEach(f => {
                const fn = __1.crypto[algorithm];
                const expected = f[algorithm];
                (0, mocha_1.it)('returns ' + expected + ' for ' + f.hex, () => {
                    const data = Buffer.from(f.hex, 'hex');
                    const actual = fn(data).toString('hex');
                    assert.strictEqual(actual, expected);
                });
            });
        });
    });
    (0, mocha_1.describe)('taggedHash', () => {
        fixtures.taggedHash.forEach(f => {
            const bytes = Buffer.from(f.hex, 'hex');
            const expected = Buffer.from(f.result, 'hex');
            (0, mocha_1.it)(`returns ${f.result} for taggedHash "${f.tag}" of ${f.hex}`, () => {
                const actual = __1.crypto.taggedHash(f.tag, bytes);
                assert.strictEqual(actual.toString('hex'), expected.toString('hex'));
            });
        });
    });
});
