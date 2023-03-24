# CsvObjectsStream
Lib to stream CSV directly to complex objects using few memory and no dependencies.

# Install


```
npm install CsvObjectsStream
```

# Input CSV format

If not specified, all columns are considered as string.
You can define column type using ()
```
prop1;prop2.value1(string);prop2.value1(boolean);prop2.value2(integer);prop2.value3.date(datetime);prop3(object)
test;gildas;true;2;2022-05-01;{"test":234}
test2;eva;false;5;2022-05-02;[{"test":123}]
```


# Usage

```
var CsvObjectsStream=require('CsvObjectsStream')

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
{"prop1":"test","prop2":{"value1":true,"value2":2,"value3":{"date":1651363200000}},"prop3":{"test":234}}
{"prop1":"test2","prop2":{"value1":false,"value2":5,"value3":{"date":1651449600000}},"prop3":[{"test":123}]}
finished
```


# Example for OpenSea

```
description;external_url;image;name;attributes(object)
Friendly OpenSea Creature that enjoys long swims in the ocean.;https://openseacreatures.io/3;https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png;Dave Starbelly;[{ "trait_type": "Base",   "value": "Starfish"  },  { "trait_type": "Eyes", "value": "Big" }  ]
Funny Creature that enjoys long swims in the ocean.;https://openseacreatures.io/3;https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png;Author;[{ "trait_type": "Base","value": "Starfish"  },  { "trait_type": "Eyes", "value": "Big" }  ]
```

Outputs:

```
{"description":"Friendly OpenSea Creature that enjoys long swims in the ocean.","external_url":"https://openseacreatures.io/3","image":"https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png","name":"Dave Starbelly","attributes":[{"trait_type":"Base","value":"Starfish"},{"trait_type":"Eyes","value":"Big"}]}
{"description":"Funny Creature that enjoys long swims in the ocean.","external_url":"https://openseacreatures.io/3","image":"https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png","name":"Author","attributes":[{"trait_type":"Base","value":"Starfish"},{"trait_type":"Eyes","value":"Big"}]}
```