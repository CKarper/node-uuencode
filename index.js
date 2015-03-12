/* jshint node: true */
/* jshint bitwise:false */

'use strict';

function encode(inString) {
	var inBytes = Buffer.isBuffer(inString) ? inString : new Buffer(inString);
	var buffLen = inBytes.length;
	var outBuffer = new Buffer(buffLen + buffLen / 3 + 1 + buffLen / 45 * 2 + 2 + 4);

	var stop = false;
	var outIndex = 0;
	var bytesRead = 0;
	var bufOffset = 0;

	do {
		var n;
		var bytesLeft = buffLen - bytesRead;

		if (bytesLeft === 0) break;

		if (bytesLeft <= 45) {
			n = bytesLeft;
		} else {
			n = 45;
		}

		outBuffer[outIndex++] = (n & 0x3F) + 32;

		for (var i = 0; i < n; i += 3) {
			if (buffLen - bufOffset < 3) {
				var padding = new Buffer(3);
				var z = 0;

				while (bufOffset + z < buffLen) {
					padding[z] = inBytes[bufOffset + z];
					++z;
				}

				encodeBytes(padding, 0, outBuffer, outIndex);
			} else {
				encodeBytes(inBytes, bufOffset, outBuffer, outIndex);
			}

			outIndex += 4;
			bufOffset += 3;
		}

		outBuffer[outIndex++] = 10;

		bytesRead += n;

		if (n >= 45) continue;

		stop = true;
	} while (!stop);

	return outBuffer.toString().substring(0, outIndex);
}

function decode(encoded) {
	if (typeof(encoded) === 'undefined') { throw new Error('Required Argument: encoded - String or Buffer must be supplied'); }

	var buf = null;
	if (Buffer.isBuffer(encoded)) { buf = encoded; }
	if (typeof(encoded) !== 'string') { throw new TypeError('Invalid Argument: encoded - Must be a String or Buffer'); }
	else { buf = new Buffer(encoded); }

	var bufLen = buf.length;
	var outBuf = new Buffer(bufLen);

	var skipLine = false,
		currReadPos = 0,
	    currWritePos = 0,
	    currReadChar,
	    chars = [],
		lineLen = 0,
		linePos = 0,
		convPos = 0;

	while (currReadPos < bufLen) {
		currReadChar = buf[currReadPos];
		if (currReadChar === CHAR_CR || currReadChar == CHAR_LF) {
			skipLine = false;
			currReadPos++;
			lineLen = 0;
			linePos = 0;
			continue;
		}
		if (skipLine) {
			currReadPos++;
			continue;
		}

		// if 'begin' or 'end'
		if ((currReadChar       === CHAR_B_LOWER &&
			 buf[currReadPos+1] === CHAR_E_LOWER &&
			 buf[currReadPos+2] === CHAR_G_LOWER &&
			 buf[currReadPos+3] === CHAR_I_LOWER &&
			 buf[currReadPos+4] === CHAR_N_LOWER) ||
			(currReadChar       === CHAR_E_LOWER &&
			 buf[currReadPos+1] === CHAR_N_LOWER &&
			 buf[currReadPos+2] === CHAR_D_LOWER)) {
			skipLine = true;
			continue;
		}

		lineLen = UUDECODE(currReadChar);
		currReadPos++;

		linePos = 0;
		convPos = 0;

		while (linePos < lineLen) {
			if (currReadPos < bufLen) {
				currReadChar = buf[currReadPos++];
				if (currReadChar === CHAR_CR || currReadChar === CHAR_LF) {
					throw new Error('Decode Error: invalid uuencoded data')
				}
			}
			else {
				currReadChar = CHAR_SPACE;
			}

			chars[convPos++] = UUDECODE(currReadChar);

			if (convPos === 4) {
				if (linePos < lineLen && currWritePos < bufLen) {
					linePos++;
					outBuf[currWritePos++] = ((chars[0] & 0x3F) << 2) | ((chars[1] & 0x3F) >> 4);
				}
				if (linePos < lineLen && currWritePos < bufLen) {
					linePos++;
					outBuf[currWritePos++] = ((chars[1] & 0x3F) << 4) | ((chars[2] & 0x3F) >> 2);
				}
				if (linePos < lineLen && currWritePos < bufLen) {
					linePos++;
					outBuf[currWritePos++] = ((chars[2] & 0x3F) << 6) | (chars[3] & 0x3F);
				}
				if (currWritePos >= bufLen && linePos < lineLen) {
					throw new Error('Internal Error: decoded buffer is not large enough. Complain to the module author.');
				}
				convPos = 0;
			}
		}
	}

	return outBuf.slice(0, currWritePos);
}

var CHAR_BACKTICK = '`'.charCodeAt(0);
var CHAR_SPACE = ' '.charCodeAt(0);
var CHAR_CR = '\r'.charCodeAt(0);
var CHAR_LF = '\n'.charCodeAt(0);
var CHAR_B_LOWER = 'b'.charCodeAt(0);
var CHAR_D_LOWER = 'd'.charCodeAt(0);
var CHAR_E_LOWER = 'e'.charCodeAt(0);
var CHAR_G_LOWER = 'g'.charCodeAt(0);
var CHAR_I_LOWER = 'i'.charCodeAt(0);
var CHAR_N_LOWER = 'n'.charCodeAt(0);

function UUDECODE(ch) {
	return (ch === CHAR_BACKTICK ? '\0' : ((ch - CHAR_SPACE) & 0x3F));
}

function encodeBytes(inBytes, offset, outBuffer, outIndex) {
	var c1 = inBytes[offset] >>> 2;
	var c2 = inBytes[offset] << 4 & 0x30 | inBytes[offset + 1] >>> 4 & 0xF;
	var c3 = inBytes[offset + 1] << 2 & 0x3C | inBytes[offset + 2] >>> 6 & 0x3;
	var c4 = inBytes[offset + 2] & 0x3F;

	outBuffer[outIndex] = (c1 & 0x3F) + 32;
	outBuffer[outIndex + 1] = (c2 & 0x3F) + 32;
	outBuffer[outIndex + 2] = (c3 & 0x3F) + 32;
	outBuffer[outIndex + 3] = (c4 & 0x3F) + 32;
}

exports.encode = encode;
exports.decode = decode;
