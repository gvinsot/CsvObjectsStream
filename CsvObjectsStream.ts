/*
 * CsvObjectsStream
 *
 * A NodeJS module that helps you reading large csv files, line by line as objects
 * without buffering the files into memory.
 *
 * Copyright (c) 2023 Gildas VINSOT
 * MIT License, see LICENSE.txt, see http://www.opensource.org/licenses/mit-license.php
 */

import * as stream from 'stream';
import { StringDecoder } from 'string_decoder';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

type BufferEncoding = NodeJS.BufferEncoding;

interface CsvObjectsStreamOptions {
    encoding?: BufferEncoding;
    separator?: string;
    skipEmptyLines?: boolean;
    start?: number;
    end?: number;
}

export default class CsvObjectsStream extends EventEmitter {
    private _regexCaptureType = '^([a-zA-Z0-9\\._\\[\\]]+)(\\((string|integer|float|object|boolean|datetime)\\)){0,1}$';
    private _regexCapturePath = '^(([a-zA-Z0-9_]+(\\[([0-9]+)\\]){0,1})(\\.){0,1})+$';
    private _regexCaptureArrayIndex = '^([a-zA-Z0-9_]+)\\[([0-9]+)\\]$';
    private _captureColumnTypeRegex = new RegExp(this._regexCaptureType);
    private _captureColumnPathRegex = new RegExp(this._regexCapturePath);
    private _captureCaptureArrayIndex = new RegExp(this._regexCaptureArrayIndex);
    private _currentLine = 0;
    private _columnsDescriptions: Array<{ jsonPath: string[], columnType: string }> = [];
    private _separator: string;
    private _encoding: BufferEncoding;
    private _readStream: stream.Readable | null;
    private _filepath!: string;
    private _streamOptions: any;
    private _skipEmptyLines: boolean;
    private _lines: string[] = [];
    private _lineFragment = '';
    private _paused = false;
    private _end = false;
    private _ended = false;
    private decoder: StringDecoder;

    constructor(filepath: string | stream.Readable, options?: CsvObjectsStreamOptions) {
        super();
        this._separator = options?.separator || ';';
        this._encoding = options?.encoding || 'utf8';
        this._skipEmptyLines = options?.skipEmptyLines || false;

        if (filepath instanceof stream.Readable) {
            this._readStream = filepath;
        } else {
            this._readStream = null;
            this._filepath = path.normalize(filepath);
            this._streamOptions = { encoding: this._encoding };
            if (options?.start) { this._streamOptions.start = options.start; }
            if (options?.end) { this._streamOptions.end = options.end; }
        }

        this.decoder = new StringDecoder(this._encoding);
        setImmediate(() => { this._initStream(); });
    }

    private parseColumnHeader(header: string): { jsonPath: string[], columnType: string } {
        if (!header) {
            return { jsonPath: ["undefined"], columnType: 'string' };
        }
        const columnHeaderFirstCapture = this._captureColumnTypeRegex.exec(header);
        if (!columnHeaderFirstCapture) {
            throw `Header "${header}" not matching expected format: ${this._regexCaptureType}`;
        }
        const columnType = columnHeaderFirstCapture[3] ?? 'string';
        const result = this._captureColumnPathRegex.exec(columnHeaderFirstCapture[1]);
        if (!result) {
            throw `Header "${header}" not matching expected format: ${this._regexCapturePath}`;
        } else {
            const jsonPath = result[0];
            return { jsonPath: jsonPath.split('.'), columnType };
        }
    }

    private setSubObjectValue(subObject: any, leaf: string, value: any): void {
        const matchArray = this._captureCaptureArrayIndex.exec(leaf);
        if (matchArray) {
            leaf = matchArray[1];
            if (!(leaf in subObject))
                subObject[leaf] = [];
            subObject[leaf][Number.parseInt(matchArray[2])] = value;
        } else {
            subObject[leaf] = value;
        }
    }

    private getSubObject(root: any, pathArray: string[]): any {
        if (pathArray.length === 1) return root;
        let current = root;
        for (let i = 0; i < pathArray.length - 1; i++) {
            let branch = pathArray[i];
            const matchArray = this._captureCaptureArrayIndex.exec(branch);
            if (matchArray) {
                branch = matchArray[1];
                const index = Number.parseInt(matchArray[2]);
                if (!(branch in current)) { current[branch] = []; }
                while (current[branch].length <= index) { current[branch].push({}); }
                current = current[branch][index];
            } else {
                if (!(branch in current)) { current[branch] = {}; }
                current = current[branch];
            }
        }
        return current;
    }

    private _initStream(): void {
        const readStream = this._readStream ? this._readStream :
            fs.createReadStream(this._filepath, this._streamOptions);
        readStream.on('error', (err: Error) => { this.emit('error', err); });
        readStream.on('open', () => { this.emit('open'); });
        readStream.on('data', (data: Buffer | string) => {
            (readStream as any).pause();
            let dataAsString = data instanceof Buffer ? this.decoder.write(data) : data as string;
            this._lines = this._lines.concat(dataAsString.split(/(?:\n|\r\n|\r)/g));
            this._lines[0] = this._lineFragment + this._lines[0];
            this._lineFragment = this._lines.pop() || '';
            setImmediate(() => { this._nextLine(); });
        });
        readStream.on('end', () => { 
            if (this._lineFragment.length > 0) {
                this._lines.push(this._lineFragment);
                this._lineFragment = '';
            }
            this._end = true; 
            setImmediate(() => { this._nextLine(); }); 
        });
        this._readStream = readStream;
    }

    private _nextLine(): void {
        if (this._paused || this._ended) return;
        if (this._lines.length === 0) {
            if (this._end) {
                if (this._lineFragment) { this._lineFragment = ''; }
                this.end();
            } else { (this._readStream as any).resume(); }
            return;
        }
        const line = this._lines.shift() as string;
        if (!this._skipEmptyLines || line.length > 0) {
            const columns = line.split(this._separator);
            if (this._currentLine === 0) {
                columns.forEach(column => {
                    this._columnsDescriptions.push(this.parseColumnHeader(column));
                });
            } else {
                const resultObject: any = {};
                columns.forEach((columnValue, index) => {
                    const description = this._columnsDescriptions[index];
                    const leaf = description.jsonPath[description.jsonPath.length - 1];
                    const subObject = this.getSubObject(resultObject, description.jsonPath);
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
                            this.setSubObjectValue(subObject, leaf, JSON.parse(columnValue));
                            break;
                        case "boolean":
                            this.setSubObjectValue(subObject, leaf, columnValue.toLowerCase() === 'true');
                            break;
                        case "string":
                        default:
                            this.setSubObjectValue(subObject, leaf, columnValue);
                    }
                });
                this.emit('line', resultObject);
            }
            this._currentLine++;
        }
        setImmediate(() => { this._nextLine(); });
    }

    pause(): void {
        this._paused = true;
    }

    resume(): void {
        this._paused = false;
        setImmediate(() => { this._nextLine(); });
    }

    end(): void {
        if (!this._ended) {
            this._ended = true;
            this.emit('end');
        }
    }

    close(): void {
        this._readStream?.destroy();
        this._end = true;
        this._lines = [];
        setImmediate(() => { this._nextLine(); });
    }
}

// Fonction pour convertir une string en Readable stream
function stringToStream(text: string): stream.Readable {
    const s = new stream.Readable();
    s.push(text);
    s.push(null); // Fin du stream
    return s;
}

export async function parseCsv(csvString: string, options?: CsvObjectsStreamOptions): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const results: any[] = [];
        const csvStream = stringToStream(csvString);
        const parser = new CsvObjectsStream(csvStream, options);

        parser.on('line', (line: any) => {
            results.push(line);
        });

        parser.on('end', () => {
            resolve(results);
        });

        parser.on('error', (err: Error) => {
            reject(err);
        });
    });
}