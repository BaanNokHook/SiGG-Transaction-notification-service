"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const types = require("../src/types");
const typeforce = require('typeforce');
(0, mocha_1.describe)('types', () => {
    (0, mocha_1.describe)('Buffer Hash160/Hash256', () => {
        const buffer20byte = Buffer.alloc(20);
        const buffer32byte = Buffer.alloc(32);
        (0, mocha_1.it)('return true for valid size', () => {
            assert(types.Hash160bit(buffer20byte));
            assert(types.Hash256bit(buffer32byte));
        });
        (0, mocha_1.it)('return true for oneOf', () => {
            assert.doesNotThrow(() => {
                typeforce(types.oneOf(types.Hash160bit, types.Hash256bit), buffer32byte);
            });
            assert.doesNotThrow(() => {
                typeforce(types.oneOf(types.Hash256bit, types.Hash160bit), buffer32byte);
            });
        });
        (0, mocha_1.it)('throws for invalid size', () => {
            assert.throws(() => {
                types.Hash160bit(buffer32byte);
            }, /Expected Buffer\(Length: 20\), got Buffer\(Length: 32\)/);
            assert.throws(() => {
                types.Hash256bit(buffer20byte);
            }, /Expected Buffer\(Length: 32\), got Buffer\(Length: 20\)/);
        });
    });
    (0, mocha_1.describe)('Satoshi', () => {
        [
            { value: -1, result: false },
            { value: 0, result: true },
            { value: 1, result: true },
            { value: 20999999 * 1e8, result: true },
            { value: 21000000 * 1e8, result: true },
            { value: 21000001 * 1e8, result: false },
        ].forEach(f => {
            (0, mocha_1.it)('returns ' + f.result + ' for valid for ' + f.value, () => {
                assert.strictEqual(types.Satoshi(f.value), f.result);
            });
        });
    });
    (0, mocha_1.describe)('UInt31', () => {
        const UINT31_MAX = Math.pow(2, 31) - 1;
        (0, mocha_1.it)('return true for valid values', () => {
            assert.strictEqual(types.UInt31(0), true);
            assert.strictEqual(types.UInt31(1000), true);
            assert.strictEqual(types.UInt31(UINT31_MAX), true);
        });
        (0, mocha_1.it)('return false for negative values', () => {
            assert.strictEqual(types.UInt31(-1), false);
            assert.strictEqual(types.UInt31(-UINT31_MAX), false);
        });
        (0, mocha_1.it)(`return false for value > ${UINT31_MAX}`, () => {
            assert.strictEqual(types.UInt31(UINT31_MAX + 1), false);
        });
    });
    (0, mocha_1.describe)('BIP32Path', () => {
        (0, mocha_1.it)('return true for valid paths', () => {
            assert.strictEqual(types.BIP32Path("m/0'/0'"), true);
            assert.strictEqual(types.BIP32Path("m/0'/0"), true);
            assert.strictEqual(types.BIP32Path("m/0'/1'/2'/3/4'"), true);
        });
        (0, mocha_1.it)('return false for invalid paths', () => {
            assert.strictEqual(types.BIP32Path('m'), false);
            assert.strictEqual(types.BIP32Path("n/0'/0'"), false);
            assert.strictEqual(types.BIP32Path("m/0'/x"), false);
        });
        (0, mocha_1.it)('return "BIP32 derivation path" for JSON.strigify()', () => {
            const toJsonValue = JSON.stringify(types.BIP32Path);
            assert.equal(toJsonValue, '"BIP32 derivation path"');
        });
    });
});
