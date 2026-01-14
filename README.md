# CsvObjectsStream

A lightweight, zero-dependency library for streaming CSV files directly into complex JavaScript objects with minimal memory footprint.

## ✨ Features

- **Memory Efficient** — Stream-based processing for handling large CSV files
- **Zero Dependencies** — No external packages required
- **Type Casting** — Automatic conversion to strings, booleans, integers, dates, and JSON objects
- **Nested Objects** — Support for dot notation to create deeply nested structures
- **Array Support** — Build arrays using bracket notation in column headers
- **Event-Driven** — Simple event-based API for processing rows

---

## 🔄 How It Works

Transform flat CSV rows into rich, nested JavaScript objects:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📄 CSV INPUT                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  name       ; age(integer) ; address.city ; address.zip ; tags[0] ; tags[1]│
│  ──────────────────────────────────────────────────────────────────────────│
│  Alice      ; 28           ; Paris        ; 75001       ; dev     ; js     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │  CsvObjectsStream
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  📦 JAVASCRIPT OBJECT                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  {                                                                          │
│    "name": "Alice",                                                         │
│    "age": 28,                         ← integer conversion                  │
│    "address": {                       ← nested object from dot notation     │
│      "city": "Paris",                                                       │
│      "zip": "75001"                                                         │
│    },                                                                       │
│    "tags": ["dev", "js"]              ← array from bracket notation         │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

```bash
npm install csv-objects-streamer
```

---

## 🚀 Quick Start

```javascript
const CsvObjectsStream = require('csv-objects-streamer');

const stream = new CsvObjectsStream('data.csv', {
  encoding: 'utf8',
  skipEmptyLines: true,
  separator: ';'
});

stream.on('line', (object) => {
  console.log(object);
});

stream.on('error', (err) => {
  console.error('Error:', err);
});

stream.on('end', () => {
  console.log('Processing complete');
});
```

---

## 📄 CSV Header Syntax

### Column Types

Define column types by appending `(type)` to the column name. If omitted, the value defaults to `string`.

| Type | Description | Example Header |
|------|-------------|----------------|
| `string` | Text value (default) | `name` or `name(string)` |
| `boolean` | Boolean value | `active(boolean)` |
| `integer` | Integer number | `count(integer)` |
| `datetime` | Date as Unix timestamp (ms) | `createdAt(datetime)` |
| `object` | Parsed JSON object | `metadata(object)` |

### Nested Objects

Use dot notation to create nested object structures:

```
user.name;user.email;user.address.city
```

### Arrays

Use bracket notation with indices to build arrays:

```
items[0].name;items[0].price;items[1].name;items[1].price
```

---

## 📖 Examples

### Basic Usage

**Input CSV:**

```csv
prop1;prop2.stringValue(string);prop2.booleanValue(boolean);prop2.integerValue(integer);prop2.dateValue(datetime);prop3(object)
test;gildas;true;2;2022-05-01;{"test":234}
test2;eva;false;5;2022-05-02;[{"test":123}]
```

**Output:**

```json
{
  "prop1": "test",
  "prop2": {
    "stringValue": "gildas",
    "booleanValue": true,
    "integerValue": 2,
    "dateValue": 1651363200000
  },
  "prop3": { "test": 234 }
}
```

---

### OpenSea Metadata Example

**Input CSV:**

```csv
description;external_url;image;name;attributes[0].trait_type;attributes[0].value;attributes[1].trait_type;attributes[1].value
Friendly OpenSea Creature.;https://openseacreatures.io/3;https://example.com/3.png;Dave Starbelly;Base;Starfish;Eyes;Big
```

**Output:**

```json
{
  "description": "Friendly OpenSea Creature.",
  "external_url": "https://openseacreatures.io/3",
  "image": "https://example.com/3.png",
  "name": "Dave Starbelly",
  "attributes": [
    { "trait_type": "Base", "value": "Starfish" },
    { "trait_type": "Eyes", "value": "Big" }
  ]
}
```

---

## ⚙️ Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | `string` | `'utf8'` | File encoding |
| `separator` | `string` | `';'` | Column delimiter |
| `skipEmptyLines` | `boolean` | `false` | Skip empty lines in the CSV |

---

## 📡 Events

| Event | Callback Argument | Description |
|-------|-------------------|-------------|
| `line` | `object` | Emitted for each parsed row |
| `error` | `Error` | Emitted when an error occurs |
| `end` | — | Emitted when processing is complete |

---

## 📝 License

MIT
