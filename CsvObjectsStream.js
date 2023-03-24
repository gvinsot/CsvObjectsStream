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
if (typeof global.setImmediate == 'undefined') { setImmediate = process.nextTick;}


var CsvObjectsStream = function (filepath, options) {
	var self = this;

	this._regexString='^([a-zA-Z0-9_.]+)(\\((string|integer|float|object|boolean|datetime)\\)){0,1}$';    
	this._columnRegex=new RegExp(this._regexString);
	this._currentLine = 0;
	this._result = [];
	this._columnsDescriptions=[];
	this._separator = options && options.separator || ';';

	this.parseColumnHeader=(header)=>{
		if(!header)
		{
			return {jsonPath:["undefined"],columnType:'string'}
		}
		let result = header.match(this._columnRegex);
		if(!result)
		{
			throw `Header "${header}" not matching expected format: ${this._regexString}`;
		}
		else
		{
			// console.log(header);
			// console.log(JSON.stringify(result));
			return {
				jsonPath:result[1].split('.'),
				columnType:result[3]?? 'string'
			}
		}
	}
	
	this.getSubObject=(root,pathArray)=>{
		if(pathArray.length==1)
			return root;
		else
		{
			var current=root;
			for(var i=0;i<pathArray.length-1;i++)
			{
				if(!(pathArray[i] in current))
					current[pathArray[i]]={};
				current=current[pathArray[i]];
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
		
		let columns=line.split(this._separator);    
		if(this._currentLine == 0)
		{
			columns.forEach(column => {
				this._columnsDescriptions.push(this.parseColumnHeader(column));
			});
			//console.log(`DEBUG: headers ${JSON.stringify(this._columnsDescriptions)}`);
		}
		else
		{
			var resultObject={};
			var index=0;
			columns.forEach(columnValue=>{
				//console.log(`DEBUG: Reading value ${columnValue}`);
				let description=this._columnsDescriptions[index];
				let leaf=description.jsonPath[description.jsonPath.length-1];
				//console.log("Parsing " +description.columnType+ " "+ columnValue);
				switch(description.columnType)
				{
					case "integer":
						this.getSubObject(resultObject,description.jsonPath)[leaf]= Number.parseInt(columnValue);
						break;

					case "float":
						this.getSubObject(resultObject,description.jsonPath)[leaf]= Number.parseFloat(columnValue);
						break;

					case "datetime":
						this.getSubObject(resultObject,description.jsonPath)[leaf]= Date.parse(columnValue);
						break;

					case "object":
						this.getSubObject(resultObject,description.jsonPath)[leaf]= JSON.parse(columnValue);
						break;

					case "boolean":
						this.getSubObject(resultObject,description.jsonPath)[leaf]= columnValue.toLowerCase() == 'true';
						break;

					case "string":
					default:						
						this.getSubObject(resultObject,description.jsonPath)[leaf]=columnValue;
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
	if (!this._ended){
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
