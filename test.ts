import { parseCsv } from './CsvObjectsStream';
import CsvObjectsStream from './CsvObjectsStream';
import fs from 'fs';

var fileContent = fs.readFileSync('test.csv', 'utf8');

parseCsv(fileContent,{ separator: ';', skipEmptyLines: true }).then((objects) => {
    console.log("parseCSV: "+ JSON.stringify(objects));
});


const objectsStreamer = new CsvObjectsStream('test.csv', { encoding: 'utf8', skipEmptyLines: true, separator: ';' });

objectsStreamer.on('error', (err: Error) => {
	console.log(`ERROR: ${err}`);
});

objectsStreamer.on('line', (object: any) => {
	console.log(JSON.stringify(object));
});

objectsStreamer.on('end', () => {
	console.log("finished");
});