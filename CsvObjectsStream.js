/*
 * CsvObjectsStream
 *
 * A NodeJS module that helps you reading large csv files, line by line as objects
 * without buffering the files into memory.
 *
 * Copyright (c) 2023 Gildas VINSOT
 * MIT License, see LICENSE.txt, see http://www.opensource.org/licenses/mit-license.php
 */

var stream = require('stream');
var StringDecoder = require('string_decoder').StringDecoder;
var path = require('path');
var fs = require('fs');
var events = require("events");

// let's make sure we have a setImmediate function (node.js <0.10)
if (typeof global.setImmediate == 'undefined') { setImmediate = process.nextTick; }


var CsvObjectsStream = function (filepath, options) {
	var self = this;
	this._regexCaptureType = '^([a-zA-Z0-9\\._\\[\\]]+)(\\((string|integer|float|object|boolean|datetime)\\)){0,1}$';
	this._regexCapturePath = '^(([a-zA-Z0-9_]+(\\[([0-9]+)\\]){0,1})(\\.){0,1})+$';
	this._regexCaptureArrayIndex = '^([a-zA-Z0-9_]+)\\[([0-9]+)\\]$';
	this._captureColumnTypeRegex = new RegExp(this._regexCaptureType);
	this._captureColumnPathRegex = new RegExp(this._regexCapturePath);
	this._captureCaptureArrayIndex = new RegExp(this._regexCaptureArrayIndex);
	this._currentLine = 0;
	this._result = [];
	this._columnsDescriptions = [];
	this._separator = options && options.separator || ';';

	this.parseColumnHeader = (header) => {
		if (!header) {
			return { jsonPath: ["undefined"], columnType: 'string' }
		}
		let columnHeaderFirstCapture = this._captureColumnTypeRegex.exec(header);
		if (!columnHeaderFirstCapture) {
			throw `Header "${header}" not matching expected format: ${this._captureColumnTypeRegex}`;
		}

		let columnType = columnHeaderFirstCapture[3] ?? 'string'
		//console.log(JSON.stringify(columnHeaderFirstCapture));

		let result = this._captureColumnPathRegex.exec(columnHeaderFirstCapture[1]);
		//console.log(JSON.stringify(result));
		if (!result) {
			throw `Header "${header}" not matching expected format: ${this._regexString}`;
		}
		else {
			let jsonPath = result[0];
			//console.log(JSON.stringify(result));
			return {
				jsonPath: jsonPath.split('.'),
				columnType: columnType
			}
		}
	}

	this.setSubObjectValue = (subObject, leaf, value) => {
		let matchArray = this._captureCaptureArrayIndex.exec(leaf);
		let matchArrayIndex = matchArray ? Number.parseInt(matchArray[2]) : 0;

		if (matchArray) {
			leaf=matchArray[1];
			if(!(leaf in subObject))
				subObject[leaf]=[];
			if (subObject[leaf].length >= matchArrayIndex)
				subObject[leaf][matchArrayIndex] = value;
			else
			{
				if(index>=current.length)
				{
					while(current[branch].length<index){
						current[branch].push({});
					}							
				}	
				subObject[leaf][matchArrayIndex] = value;
			}
				
		}
		else {
			//console.log(JSON.stringify(subObject) + ' prop '+ leaf + "->"+value);
			subObject[leaf] = value;
		}
	}

	this.getSubObject = (root, pathArray) => {
		//console.log("DEBUG "+JSON.stringify(root) +":"+  JSON.stringify(pathArray));
		if (pathArray.length == 1)
			return root;
		else {
			var current = root;
			for (var i = 0; i < pathArray.length - 1; i++) {
				let branch = pathArray[i];
				let matchArray = this._captureCaptureArrayIndex.exec(branch);
				if (matchArray) {			
					branch = matchArray[1];
					let index=Number.parseInt(matchArray[2]);
					//console.log("setting up "+branch+":"+index+" on "+JSON.stringify(current));
					if (!(branch in current)) {
						current[branch] = [];	
						//console.log("adding branch array");				
					}
					
					if(index>=current[branch].length)
					{
						while(current[branch].length<=index){
							current[branch].push({});
						}							
					}				
					//console.log(">"+JSON.stringify(current) );		
					current = current[branch][index];
				}
				else {
					if (!(branch in current)) {
						current[branch] = {};
					}
					current = current[branch];
				}
			}

			return current;
		}
	}

	this._encoding = options && options.encoding || 'utf8';
	if (filepath instanceof stream.Readable) {
		this._readStream = filepath;
	}
	else {
		this._readStream = null;
		this._filepath = path.normalize(filepath);
		this._streamOptions = { encoding: this._encoding };

		if (options && options.start) {
			this._streamOptions.start = options.start;
		}

		if (options && options.end) {
			this._streamOptions.end = options.end;
		}
	}
	this._skipEmptyLines = options && options.skipEmptyLines || false;

	this._lines = [];
	this._lineFragment = '';
	this._paused = false;
	this._end = false;
	this._ended = false;
	this.decoder = new StringDecoder(this._encoding);

	events.EventEmitter.call(this);

	setImmediate(function () {
		self._initStream();
	});
};

CsvObjectsStream.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: CsvObjectsStream,
		enumerable: false
	}
});

CsvObjectsStream.prototype._initStream = function () {
	var self = this,
		readStream = this._readStream ? this._readStream :
			fs.createReadStream(this._filepath, this._streamOptions);

	readStream.on('error', function (err) {
		self.emit('error', err);
	});

	readStream.on('open', function () {
		self.emit('open');
	});

	readStream.on('data', function (data) {
		self._readStream.pause();
		var dataAsString = data;
		if (data instanceof Buffer) {
			dataAsString = self.decoder.write(data);
		}
		self._lines = self._lines.concat(dataAsString.split(/(?:\n|\r\n|\r)/g));

		self._lines[0] = self._lineFragment + self._lines[0];
		self._lineFragment = self._lines.pop() || '';

		setImmediate(function () {
			self._nextLine();
		});
	});

	readStream.on('end', function () {
		self._end = true;

		setImmediate(function () {
			self._nextLine();
		});
	});

	this._readStream = readStream;
};

CsvObjectsStream.prototype._nextLine = function () {
	var self = this,
		line;

	if (this._paused) {
		return;
	}
	if (this._lines.length === 0) {
		if (this._end) {
			if (this._lineFragment) {
				//this.emit('line', this._lineFragment);
				this._lineFragment = '';
			}
			if (!this._paused) {
				this.end();
			}
		} else {
			this._readStream.resume();
		}
		return;
	}

	line = this._lines.shift();

	if (!this._skipEmptyLines || line.length > 0) {

		let columns = line.split(this._separator);
		if (this._currentLine == 0) {
			columns.forEach(column => {
				this._columnsDescriptions.push(this.parseColumnHeader(column));
			});
			//console.log(`DEBUG: headers ${JSON.stringify(this._columnsDescriptions)}`);
		}
		else {
			var resultObject = {};
			var index = 0;
			columns.forEach(columnValue => {
				//console.log(`DEBUG: Reading value ${columnValue}`);
				let description = this._columnsDescriptions[index];
				let leaf = description.jsonPath[description.jsonPath.length - 1];
				//console.log("Parsing " +description.columnType+ " "+ columnValue);
				let subObject = this.getSubObject(resultObject, description.jsonPath);
				switch (description.columnType) {
					case "integer":
						this.setSubObjectValue(subObject, leaf, Number.parseInt(columnValue));
						break;

					case "float":
						this.setSubObjectValue(subObject, leaf, Number.parseFloat(columnValue));
						break;

					case "datetime":
						this.setSubObjectValue(subObject, leaf, Date.parse(columnValue));
						break;

					case "object":
						this.setSubObjectValue(subObject, leaf,JSON.parse(columnValue));
						break;

					case "boolean":
						this.setSubObjectValue(subObject, leaf, columnValue.toLowerCase() == 'true');
						break;

					case "string":
					default:
						this.setSubObjectValue(subObject, leaf, columnValue);
				}
				index++;
			});
			this.emit('line', resultObject);
		}
		this._currentLine++;

	}

	setImmediate(function () {
		if (!this._paused) {
			self._nextLine();
		}
	});
};

CsvObjectsStream.prototype.pause = function () {
	this._paused = true;
};

CsvObjectsStream.prototype.resume = function () {
	var self = this;

	this._paused = false;

	setImmediate(function () {
		self._nextLine();
	});
};

CsvObjectsStream.prototype.end = function () {
	if (!this._ended) {
		this._ended = true;
		this.emit('end');
	}
};

CsvObjectsStream.prototype.close = function () {
	var self = this;

	this._readStream.destroy();
	this._end = true;
	this._lines = [];

	setImmediate(function () {
		self._nextLine();
	});
};

module.exports = CsvObjectsStream;
