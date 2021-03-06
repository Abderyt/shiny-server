/*
 * app-config.js
 *
 * Copyright (C) 2009-13 by RStudio, Inc.
 *
 * This program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */
var config = require('../config/config');
var fsutil = require('../core/fsutil');
var map = require('../core/map');
var path = require('path');
var _ = require('underscore');
var Q = require('q');
var events = require('events');

module.exports = AppConfig;

function AppConfig(schedulerRegistry) {
  this.$cache = map.create();
  var self = this;

  schedulerRegistry.on('vacantSched', function(appKey){
    delete self.$cache[appKey];
  });
}

(function() {
  this.readConfig_p = function(appSpec) {
    var key = appSpec.getKey();
    if (_.has(this.$cache, key)){
      // We already have this appSpec cached, just return it.
      return this.$cache[key];
    }

    var appDir = appSpec.appDir;

    var self = this;

    return findConfig_p(appDir)
    .then(function(confPath){
      var conf = config.read_p(
        confPath, 
        path.join(__dirname, '../router/shiny-server-rules.config'));

      // Cache the response for later use.
      self.$cache[key] = Q.fcall(function(){ return conf;});
      return conf;
    }, function(err){
      // No app configuration file found. Return null.
      self.$cache[key] = Q.fcall(function(){ return null;});
      return null;
    });
  }
  
  /**
   * Supplement the base config with the app-specific config.
   * 
   */ 
  this.addLocalConfig = function(baseConfig, appConfig){
    if (!appConfig || _.size(appConfig) == 0){
      return baseConfig;
    }

    // Filter appConfig to only have whitelisted properties. (Don't allow a local
    // app to overwrite runAs, for instance).
    appConfig = _.pick(appConfig, 'appDefaults', 'scheduler');

    baseConfig.settings = merge(baseConfig.settings, appConfig);
    return baseConfig;
  }

}).call(AppConfig.prototype);


/**
 * Check to see if there's a configuration file in the given app directory,
 * if so, parse it.
 * @param appDir The base directory in which the application is hosted.
 * @return A promise resolving to the path of the application-specific
 *   configuration file
 */
function findConfig_p(appDir){
  var filePath = path.join(appDir, ".shiny_app.conf");
  return fsutil.safeStat_p(filePath)
  .then(function(stat){
    if (stat && stat.isFile()){
      return (filePath);
    }
    throw new Error('Invalid app configuration file.');
  });
}


function merge(src, target){
  for (var el in src){
    if (typeof src[el] === 'object') {
      target[el] = merge(target[el], src[el]);
    } else{
      target[el] = src[el];
    }
  }
  return target;
}
