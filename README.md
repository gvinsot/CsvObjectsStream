# CsvObjectsStream
Lib to stream CSV directly to complex objects using few memory and no dependencies.

# Install


```
npm install csv-objects-streamer
```

# Input CSV format

If not specified, all columns are considered as string.
You can define column type using ()
```
prop1;prop2.stringValue(string);prop2.booleanValue(boolean);prop2.integerValue(integer);prop2.dateValue(datetime);prop3(object);prop2.value4.sub1;prop2.value4.sub2(string);prop2.value5[0](integer);prop2.value5[1](integer)
test;gildas;true;2;2022-05-01;{"test":234};foo;1;1;2
test2;eva;false;5;2022-05-02;[{"test":123}];bar;2;1;2
```


# Usage

```
var CsvObjectsStream=require('csv-objects-streamer')

let objectsStreamer = new CsvObjectsStream('test_opensea.csv', { encoding: 'utf8', skipEmptyLines: true, separator:';' });

objectsStreamer.on('error', function (err) {
	console.log(`ERROR: ${err}`);
});

objectsStreamer.on('line', function (object) {
	console.log(JSON.stringify(object));
});

objectsStreamer.on('end', function () {
	console.log("finished");
});
```

# Output

```
{"prop1":"test","prop2":{"stringValue":"gildas","booleanValue":true,"integerValue":2,"dateValue":1651363200000,"value4":{"sub1":"foo","sub2":"1"},"value5":[1,2]},"prop3":{"test":234}}
{"prop1":"test2","prop2":{"stringValue":"eva","booleanValue":false,"integerValue":5,"dateValue":1651449600000,"value4":{"sub1":"bar","sub2":"2"},"value5":[1,2]},"prop3":[{"test":123}]}
finished
```


# Example for OpenSea

```
description;external_url;image;name;attributes[0].trait_type;attributes[0].value;attributes[1].trait_type;attributes[1].value
Friendly OpenSea Creature.;https://openseacreatures.io/3;https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png;Dave Starbelly;Base;Starfish;Eyes;Big
Hostile Creature.;https://openseacreatures.io/3;https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png;Author;Base;Starfish;Eyes;Big
```

Outputs:

```
{"description":"Friendly OpenSea Creature.","external_url":"https://openseacreatures.io/3","image":"https://storage.googleapis.com/opensea-prod.appsspot.com/puffs/3.png","name":"Dave Starbelly","attributes":[{"trait_type":"Base","value":"Starfish"},{"trait_type":"Eyes","value":"Big"}]}
{"description":"Hostile Creature.","external_url":"https://openseacreatures.io/3","image":"https://storage.googleapis.com/opensea-prod.appspot.com/ppuffs/3.png","name":"Author","attributes":[{"trait_type":"Base","value":"Starfish"},{"trait_type":"Eyes","value":"Big"}]}
finished
```