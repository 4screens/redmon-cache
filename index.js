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
      debug.apply(this, arguments);
      if(externalLogger) {
        externalLogger.debug.apply(this, arguments);
      }
    },
    error: function() {
      debug.apply(this, arguments);
      if(externalLogger) {
        externalLogger.error.apply(this, arguments);
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

  function getKey(DatabaseModel, id) {
    var key = prefix + DatabaseModel.modelName + ':' + id;
    log.debug('Redis key:', key);
    return key;
  }

  function getFromDB(DatabaseModel, id, ttl)
  {
    return q(DatabaseModel.findOne({ _id: id }).exec())
      .then(function(data) {
        if(data) {
          log.debug('Got data from database. Saving in redis. TTL: ' + (ttl || defaultTTL));
           redisClient.set(getKey(DatabaseModel, id), JSON.stringify(data), 'EX', ttl || defaultTTL, 'NX')
            .catch(function(err) {
              log.error('error while saving to redis', err);
            });
        }
        
        return data;
      });
  }
  return {
    get: function(DatabaseModel, id, ttl) {
      var defered = q.defer();
      redisClient.get(getKey(DatabaseModel, id))
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
            var result = new DatabaseModel(JSON.parse(redisData));
            defered.resolve(result);
          }
        })
        .catch(function(err) {
          log.error('Failed to get data from redis because of error', err);
          log.debug('Attempting to get data from database');
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
    delete: function(DatabaseModel, id) {
      return redisClient.del(getKey(DatabaseModel, id));
    }
  };


};