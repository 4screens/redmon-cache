# redmon-cache

  tiny node.js module for caching objects using Redis.

## Installation

```bash
$ npm install redmon-cache
```

##Purpose
`redmon-cache` was created to easily cache objects in distributed environment (like micro-service application). I'm using it mostly to cache documents retrieved from MongoDB that are not changing too often but it's very important to be able to invalidate cache across all applications/services at once.

This module is work in progress.

## Usage
Plain object example _app.js_:

```js
var cache = require('redmon-cache')();

cache.set('my-data, { status: 'ok', iAm: 'Batman' }, 15)
  .then(function(data) {
    console.log('Data cached');
    
    cache.get('my-data')
        .then(function(cached) {
            console.log('Data from cache', cached);
        });
  });
```

Mongoose example _app.js_:

```js
var someMongooseModel = require('./userModel');
var cache = require('redmon-cache')();

cache.mongoGet(someMongooseModel, '5475c628d4a04400009a2596', 10)
  .then(function(data) {
    console.log('data', data);
  })
  .catch(function(err) {
    console.log('error', err);
  });
```

Advanced Mongoose example _app.js_:

```js
var redis = require("redis"),
  client = redis.createClient();
var someMongooseModel = require('./userModel');
var cache = require('redmon-cache')({
    redisClient: client,
    redisPrefix: 'my-app:',
    defaultTTL: 30
});

cache.mongoGet(someMongooseModel, '5475c628d4a04400009a2596', 10)
  .then(function(data) {
    console.log('data', data);
  })
  .catch(function(err) {
    console.log('error', err);
  });
```

##API

All methods are returning promisses. Resolved promise means that all operations are finished.

- **get(key)** - gets cached object. If there is nothing under this key it will return _null_
- **set(key, data, ttl)** - caches data under key
- **del(mongooseModel, id)** - deletes document from cache
- **mongoGet(mongooseModel, id, ttl)** - gets cached document. If it's not in cache it gets it from database and caches it.
   - mongooseModel - model of collection from whitch the object will be retreived
   - id - _id of object that will be retreived. This can be ObjectId or String
   - ttl - time (in seconds) after witch object will be dropped from cache

## Options
| Name          | Default     | Default     |
| :------------- | :----------- | :----------- |
| defaultTTL |   60s   | default time to live of object in cache. |
| redisClient |   internal   | client for connecting to redis (ioredis) |
| redisPrefix |  none    | custom prefix for cache keys |
| redisPort |   6379   | redis port for internal redis client connection (used if redisClient option is not set) |
| redisHost |   localhost   | redis host for internal redis client connection (used if redisClient option is not set) |
| log |   debug   | External logger. Must support debug and error methods |

## Authors

 - Tomasz Marciszewski

## License

(The ISC License)

Copyright (c) 2014 Tomasz Marciszewski

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
