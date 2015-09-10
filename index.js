module.exports = function(options) {
  'use strict';
  var Redis = require('ioredis'),
    q = require('q'),
    debug = require('debug')('redmon-cache'),
    prefix = 'redmon-cache:',
    defaultTTL = 60; //1 minute

  //options
  /*
    defaultTTL - default time to live of object in cache. 
    redisClient - client for connecting to redis (ioredis)
    redisPrefix - custom prefix for cache keys
    redisPort - redis port for internal redis client connection (used if redisClient option is not set)
    redisHost - redis host for internal redis client connection (used if redisClient option is not set)
    log - External logger. Must support debug and error methods
  */
  
  var log = {
    debug: function() {
      if(externalLogger && externalLogger.debug) {
        externalLogger.debug.apply(externalLogger, arguments);
      }
      else {
        debug.apply(debug, arguments);
      }
    },
    error: function() {
      if(externalLogger && externalLogger.error) {
        externalLogger.error.apply(this, arguments);
      }
      else {
        debug.apply(debug, arguments);
      }
    }
  };

  if (!options) {
    options = {};
  }

  if (options.redisPrefix){
    prefix = options.redisPrefix + prefix;
    log.debug('Setting redis prefix to ' + prefix);
  }

  if(options.defaultTTL) {
    defaultTTL = options.defaultTTL;
    log.debug('Setting default TTL to ' + defaultTTL + ' seconds');
  }

  if(options.log){
    log.debug('Setting external logger');
    var externalLogger = options.log;
  }

  var redisClient =
    options.redisClient ? options.redisClient : new Redis(options.redisPort, options.redisHost);

  function getKey(key) {
    return prefix + key;
  }
  function getMongoKey(DatabaseModel, id) {
    var key = prefix + DatabaseModel.modelName + ':' + id;
    return key;
  }

  function setInRedis(key, data, ttl) {
    return redisClient.set(key, JSON.stringify(data), 'EX', ttl || defaultTTL)
      .finally(function() {
        if(dbQueries[key]) {
          delete(dbQueries[key]);
        }
      });
  }

  var dbQueries = {};
  var redisQueries = {};

  function getFromRedis(key, DatabaseModel) {

    if(redisQueries[key]) {
      return redisQueries[key];
    }
    
    redisQueries[key] = redisClient.get(key)
      .then(function(data) {
        if(data) {
          log.debug('Got data for ' + key + ' from redis');
        } else {
          log.debug('No data for ' + key + ' in redis');
        }
        
        data = JSON.parse(data);
        if(DatabaseModel && data) {
          var result = new DatabaseModel(data, Object.keys(data), true);
          result.init(data);
          return result;
        } else {
          return data;
        }
      })
      .then(function(data) {
        if(redisQueries[key]) {
          delete(redisQueries[key]);
        }

        return data;
      });

    return redisQueries[key];
  }

  function getFromDB(DatabaseModel, id, ttl)
  {
    var cacheKey = getMongoKey(DatabaseModel, id);
    if(!!dbQueries[cacheKey]) {
      return dbQueries[cacheKey];
    }

    dbQueries[cacheKey] = q(DatabaseModel.findOne({ _id: id }).exec())
      .then(function(data) {
        if(data) {
          log.debug('Got data from database. Saving in redis. TTL: ' + (ttl || defaultTTL));
          setInRedis(getMongoKey(DatabaseModel, id), data, ttl)
            .catch(function(err) {
              log.error('error while saving to redis', err);
            });
        }
        
        return data;
      });

    return dbQueries[cacheKey];
  }
  return {
    set: function(key, data, ttl){
      return setInRedis(getKey(key), data, ttl);
    },
    get: function(key) {
      return getFromRedis(getKey(key));
    },
    mongoGet: function(DatabaseModel, id, ttl) {
      if(typeof id === 'string') {
        id = id.toString();
      }
      var defered = q.defer();
      getFromRedis(getMongoKey(DatabaseModel, id), DatabaseModel)
        .then(function(redisData){
          if(!redisData) {
            log.debug('No data in redis for selected key. Attempting to get data from DB');
            getFromDB(DatabaseModel, id, ttl)
              .then(function(dbData) {
                log.debug('Returning data from database');
                defered.resolve(dbData);
              })
              .catch(function(err) {
                log.error('Failed to get data from database because of error', err);
                defered.reject(err);
              });
          }
          else {
            log.debug('Returning data from redis cache');
            defered.resolve(redisData);
          }
        })
        .catch(function(err) {
          log.error('Failed to get data from redis because of error', 'aaa', err);

          getFromDB(DatabaseModel, id, ttl)
            .then(function(dbData) {
              log.debug('Returning data from database');
              defered.resolve(dbData);
            })
            .catch(function(err) {
              log.error('Failed to get data from database because of error', err);
              defered.reject(err);
            });
        });

      return defered.promise;
    },
    del: function(DatabaseModel, id) {
      if(typeof id === 'string') {
        id = id.toString();
      }
      return redisClient.del(getMongoKey(DatabaseModel, id));
    }
  };


};