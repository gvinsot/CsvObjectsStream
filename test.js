

var CsvObjectsStream=require('./CsvObjectsStream.js');

var objectsStreamer = new CsvObjectsStream('test.csv', { encoding: 'utf8', skipEmptyLines: true, separator:';' });

objectsStreamer.on('error', function (err) {
	console.log(`ERROR: ${err}`);
});

objectsStreamer.on('line', function (object) {
	console.log(JSON.stringify(object));
});

objectsStreamer.on('end', function () {
	console.log("finished");
});