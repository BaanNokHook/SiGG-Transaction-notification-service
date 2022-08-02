"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bip32_1 = require("bip32");
const ecc = require("tiny-secp256k1");
const mocha_1 = require("mocha");
const bitcoin = require("../..");
const _regtest_1 = require("./_regtest");
const rng = require('randombytes');
const regtest = _regtest_1.regtestUtils.network;
const bip32 = (0, bip32_1.default)(ecc);
(0, mocha_1.describe)('bitcoinjs-lib (transaction with taproot)', () => {
    (0, mocha_1.it)('can create (and broadcast via 3PBP) a taproot keyspend Transaction', async () => {
        const myKey = bip32.fromSeed(rng(64), regtest);
        const output = createKeySpendOutput(myKey.publicKey);
        const address = bitcoin.address.fromOutputScript(output, regtest);
        // amount from faucet
        const amount = 42e4;
        // amount to send
        const sendAmount = amount - 1e4;
        // get faucet
        const unspent = await _regtest_1.regtestUtils.faucetComplex(output, amount);
        const tx = createSigned(myKey, unspent.txId, unspent.vout, sendAmount, [output], [amount]);
        const hex = tx.toHex();
        // console.log('Valid tx sent from:');
        // console.log(address);
        // console.log('tx hex:');
        // console.log(hex);
        await _regtest_1.regtestUtils.broadcast(hex);
        await _regtest_1.regtestUtils.verify({
            txId: tx.getId(),
            address,
            vout: 0,
            value: sendAmount,
        });
    });
});
// Order of the curve (N) - 1
const N_LESS_1 = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140', 'hex');
// 1 represented as 32 bytes BE
const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
// Function for creating a tweaked p2tr key-spend only address
// (This is recommended by BIP341)
function createKeySpendOutput(publicKey) {
    // x-only pubkey (remove 1 byte y parity)
    const myXOnlyPubkey = publicKey.slice(1, 33);
    const commitHash = bitcoin.crypto.taggedHash('TapTweak', myXOnlyPubkey);
    const tweakResult = ecc.xOnlyPointAddTweak(myXOnlyPubkey, commitHash);
    if (tweakResult === null)
        throw new Error('Invalid Tweak');
    const { xOnlyPubkey: tweaked } = tweakResult;
    // scriptPubkey
    return Buffer.concat([
        // witness v1, PUSH_DATA 32 bytes
        Buffer.from([0x51, 0x20]),
        // x-only tweaked pubkey
        tweaked,
    ]);
}
function signTweaked(messageHash, key) {
    const privateKey = key.publicKey[0] === 2
        ? key.privateKey
        : ecc.privateAdd(ecc.privateSub(N_LESS_1, key.privateKey), ONE);
    const tweakHash = bitcoin.crypto.taggedHash('TapTweak', key.publicKey.slice(1, 33));
    const newPrivateKey = ecc.privateAdd(privateKey, tweakHash);
    if (newPrivateKey === null)
        throw new Error('Invalid Tweak');
    return ecc.signSchnorr(messageHash, newPrivateKey, Buffer.alloc(32));
}
// Function for creating signed tx
function createSigned(key, txid, vout, amountToSend, scriptPubkeys, values) {
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    // Add input
    tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
    // Add output
    tx.addOutput(scriptPubkeys[0], amountToSend);
    const sighash = tx.hashForWitnessV1(0, // which input
    scriptPubkeys, // All previous outputs of all inputs
    values, // All previous values of all inputs
    bitcoin.Transaction.SIGHASH_DEFAULT);
    const signature = Buffer.from(signTweaked(sighash, key));
    // witness stack for keypath spend is just the signature.
    // If sighash is not SIGHASH_DEFAULT (ALL) then you must add 1 byte with sighash value
    tx.ins[0].witness = [signature];
    return tx;
}
