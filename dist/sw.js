(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var _idb = _interopRequireDefault(require("idb"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*jshint esversion: 6 */
var dbPromise = _idb.default.open('db-udacity-mws-rr', 1, function (upgradeDb) {
  if (!upgradeDb.objectStoreNames.contains('restaurants')) {
    var rr = upgradeDb.createObjectStore('restaurants', {
      keyPath: 'id'
    });
    var rv = upgradeDb.createObjectStore('reviews', {
      keyPath: 'id'
    }).createIndex('restaurant_id', 'restaurant_id');
  }
});

var staticCacheName = 'res-rev-static-v5';
var contentImgsCache = 'res-rev-content-imgs-v2';
var allCaches = [staticCacheName, contentImgsCache];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(staticCacheName).then(function (cache) {
    return cache.addAll(['/', '/manifest.json', //https://github.com/GoogleChrome/lighthouse/issues/2576
    '/css/styles.css', '/css/media.css', '/css/media-info.css', '/img/back.svg', '/img/star.svg', '/js/dbhelper.js', '/js/main.js', '/js/restaurant_info.js']);
  }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (cacheNames) {
    return Promise.all(cacheNames.filter(function (cacheName) {
      return cacheName.startsWith('res-rev-') && !allCaches.includes(cacheName);
    }).map(function (cacheName) {
      return caches['delete'](cacheName);
    }));
  }));
});
self.addEventListener('fetch', function (event) {
  var requestUrl = new URL(event.request.url); //if the request url has port 1337, we know it's an idb call.

  if (requestUrl.port == 1337) {
    var id = event.request.url.substring(event.request.url.lastIndexOf('/') + 1);
    console.log('service call', requestUrl, id);

    if (requestUrl.search[0] == '?') {
      console.log('hey look, a token', requestUrl.search[0]);
      console.log('but what token', requestUrl.searchParams.get('restaurant_id'), requestUrl.searchParams.get('is_favorite'));
      console.log('id for reviews first?', parseInt(requestUrl.searchParams.get('restaurant_id'), 10));
    }

    if (id == "restaurants") {
      //index
      return handleIndex(event, requestUrl);
    } else {
      //restaurant, review, or favorite
      id = parseInt(id, 10);

      if (requestUrl.searchParams.get('restaurant_id')) {
        id = parseInt(requestUrl.searchParams.get('restaurant_id'), 10);
        console.log('making a call for reviews', event, requestUrl, id);
        return handleReview(event, requestUrl, id);
      }

      if (requestUrl.searchParams.get('is_favorite')) {
        id = parseInt(requestUrl.searchParams.get('restaurant_id'), 10);
        console.log('making a call for favorites', event, requestUrl, id);
        return; //this is handled by the button...
      }

      return handleRestaurant(event, requestUrl, id);
    }
  } else {
    //otherwise, use cache
    return handleCache(event, requestUrl);
  }
});

function handleIndex(event, requestUrl) {
  event.respondWith(dbPromise.then(function (db) {
    var tx = db.transaction('restaurants', 'readonly');
    var store = tx.objectStore('restaurants');
    return store.get(-1);
  }).then(function (item) {
    return item || fetch(event.request).then(function (response) {
      return response.json();
    }).then(function (json) {
      return dbPromise.then(function (db) {
        var tx = db.transaction("restaurants", "readwrite");
        var store = tx.objectStore("restaurants");
        store.put({
          id: -1,
          data: json
        });
        json.forEach(function (restaurant) {
          store.put({
            id: restaurant.id,
            data: restaurant
          });
        });
        return json;
      });
    });
  }).then(function (eventualResponse) {
    console.log('er', eventualResponse);
    return new Response(JSON.stringify(eventualResponse.data));
  }));
}

function handleRestaurant(event, requestUrl, id) {
  event.respondWith(dbPromise.then(function (db) {
    var tx = db.transaction('restaurants', 'readonly');
    var store = tx.objectStore('restaurants');
    return store.get(Number(id));
  }).then(function (item) {
    return item || fetch(event.request).then(function (response) {
      console.log('response', response);
      return response.json();
    }).then(function (json) {
      return dbPromise.then(function (db) {
        var tx = db.transaction("restaurants", "readwrite");
        var store = tx.objectStore("restaurants");
        store.put({
          id: id,
          data: json
        });
        return json;
      });
    });
  }).then(function (eventualResponse) {
    console.log('er', eventualResponse);
    return new Response(JSON.stringify(eventualResponse.data));
  }));
}

function handleReview(event, requestUrl, id) {
  event.respondWith(dbPromise.then(function (db) {
    var tx = db.transaction('reviews', 'readonly');
    var store = tx.objectStore('reviews');
    return store.get(id);
  }).then(function (item) {
    return item || fetch(event.request).then(function (response) {
      console.log('response', response);
      return response.json();
    }).then(function (json) {
      return dbPromise.then(function (db) {
        var tx = db.transaction("reviews", "readwrite");
        var store = tx.objectStore("reviews");
        store.put({
          id: id,
          data: json
        });
        return json;
      });
    });
  }).then(function (eventualResponse) {
    console.log('er-reviews', eventualResponse);

    if (eventualResponse.id) {
      return new Response(JSON.stringify(eventualResponse.data));
    }

    return new Response(JSON.stringify(eventualResponse));
  }));
}

function handleCache(event, requestUrl) {
  if (requestUrl.origin === location.origin) {
    if (requestUrl.pathname.startsWith('/img/')) {
      event.respondWith(servePhoto(event.request));
      return;
    }
  }

  event.respondWith(caches.match(event.request).then(function (resp) {
    return resp || fetch(event.request).then(function (response) {
      var responseClone = response.clone();
      caches.open(staticCacheName).then(function (cache) {
        cache.put(event.request, responseClone);
      });
      return response;
    });
  }).catch(function (error) {
    return new Response(JSON.stringify(error), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }));
}

function servePhoto(request) {
  var storageUrl = request.url.replace(/-\d+px\.jpg$/, '');
  return caches.open(contentImgsCache).then(function (cache) {
    return cache.match(storageUrl).then(function (response) {
      if (response) return response;
      return fetch(request).then(function (networkResponse) {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}

},{"idb":2}],2:[function(require,module,exports){
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
      if (!(funcName in Constructor.prototype)) return;

      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      if (request) {
        request.onupgradeneeded = function(event) {
          if (upgradeCallback) {
            upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
          }
        };
      }

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvc3cuanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0NBOzs7O0FBREE7QUFHQSxJQUFJLFNBQVMsR0FBRyxhQUFJLElBQUosQ0FBUyxtQkFBVCxFQUE4QixDQUE5QixFQUFpQyxVQUFTLFNBQVQsRUFBb0I7QUFFakUsTUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBVixDQUEyQixRQUEzQixDQUFvQyxhQUFwQyxDQUFMLEVBQXlEO0FBQ3ZELFFBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixhQUE1QixFQUEyQztBQUFDLE1BQUEsT0FBTyxFQUFFO0FBQVYsS0FBM0MsQ0FBVDtBQUNBLFFBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixTQUE1QixFQUF1QztBQUFDLE1BQUEsT0FBTyxFQUFFO0FBQVYsS0FBdkMsRUFDRSxXQURGLENBQ2MsZUFEZCxFQUMrQixlQUQvQixDQUFUO0FBRUQ7QUFFRixDQVJhLENBQWhCOztBQVVBLElBQUksZUFBZSxHQUFHLG1CQUF0QjtBQUNBLElBQUksZ0JBQWdCLEdBQUcseUJBQXZCO0FBQ0EsSUFBSSxTQUFTLEdBQUcsQ0FBQyxlQUFELEVBQWtCLGdCQUFsQixDQUFoQjtBQUVBLElBQUksQ0FBQyxnQkFBTCxDQUFzQixTQUF0QixFQUFpQyxVQUFTLEtBQVQsRUFBZ0I7QUFDL0MsRUFBQSxLQUFLLENBQUMsU0FBTixDQUNFLE1BQU0sQ0FBQyxJQUFQLENBQVksZUFBWixFQUE2QixJQUE3QixDQUFrQyxVQUFTLEtBQVQsRUFBZ0I7QUFDaEQsV0FBTyxLQUFLLENBQUMsTUFBTixDQUFhLENBQ2xCLEdBRGtCLEVBRWxCLGdCQUZrQixFQUVBO0FBQ2xCLHFCQUhrQixFQUlsQixnQkFKa0IsRUFLbEIscUJBTGtCLEVBTWxCLGVBTmtCLEVBT2xCLGVBUGtC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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLypqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcbmltcG9ydCBpZGIgZnJvbSAnaWRiJztcclxuXHJcbnZhciBkYlByb21pc2UgPSBpZGIub3BlbignZGItdWRhY2l0eS1td3MtcnInLCAxLCBmdW5jdGlvbih1cGdyYWRlRGIpIHtcclxuXHJcbiAgICBpZiAoIXVwZ3JhZGVEYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKCdyZXN0YXVyYW50cycpKSB7XHJcbiAgICAgIGxldCByciA9IHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncmVzdGF1cmFudHMnLCB7a2V5UGF0aDogJ2lkJ30pO1xyXG4gICAgICBsZXQgcnYgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ3Jldmlld3MnLCB7a2V5UGF0aDogJ2lkJ30pXHJcbiAgICAgICAgICAgICAgICAuY3JlYXRlSW5kZXgoJ3Jlc3RhdXJhbnRfaWQnLCAncmVzdGF1cmFudF9pZCcpO1xyXG4gICAgfVxyXG5cclxuICB9KTtcclxuXHJcbnZhciBzdGF0aWNDYWNoZU5hbWUgPSAncmVzLXJldi1zdGF0aWMtdjUnO1xyXG52YXIgY29udGVudEltZ3NDYWNoZSA9ICdyZXMtcmV2LWNvbnRlbnQtaW1ncy12Mic7XHJcbnZhciBhbGxDYWNoZXMgPSBbc3RhdGljQ2FjaGVOYW1lLCBjb250ZW50SW1nc0NhY2hlXTtcclxuXHJcbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignaW5zdGFsbCcsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgZXZlbnQud2FpdFVudGlsKFxyXG4gICAgY2FjaGVzLm9wZW4oc3RhdGljQ2FjaGVOYW1lKS50aGVuKGZ1bmN0aW9uKGNhY2hlKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZS5hZGRBbGwoW1xyXG4gICAgICAgICcvJyxcclxuICAgICAgICAnL21hbmlmZXN0Lmpzb24nLCAvL2h0dHBzOi8vZ2l0aHViLmNvbS9Hb29nbGVDaHJvbWUvbGlnaHRob3VzZS9pc3N1ZXMvMjU3NlxyXG4gICAgICAgICcvY3NzL3N0eWxlcy5jc3MnLFxyXG4gICAgICAgICcvY3NzL21lZGlhLmNzcycsXHJcbiAgICAgICAgJy9jc3MvbWVkaWEtaW5mby5jc3MnLFxyXG4gICAgICAgICcvaW1nL2JhY2suc3ZnJyxcclxuICAgICAgICAnL2ltZy9zdGFyLnN2ZycsXHJcbiAgICAgICAgJy9qcy9kYmhlbHBlci5qcycsXHJcbiAgICAgICAgJy9qcy9tYWluLmpzJyxcclxuICAgICAgICAnL2pzL3Jlc3RhdXJhbnRfaW5mby5qcydcclxuICAgICAgXSk7XHJcbiAgICB9KVxyXG4gICk7XHJcbn0pO1xyXG5cclxuc2VsZi5hZGRFdmVudExpc3RlbmVyKCdhY3RpdmF0ZScsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gIGV2ZW50LndhaXRVbnRpbChjYWNoZXMua2V5cygpLnRoZW4oZnVuY3Rpb24gKGNhY2hlTmFtZXMpIHtcclxuICAgIHJldHVybiBQcm9taXNlLmFsbChjYWNoZU5hbWVzLmZpbHRlcihmdW5jdGlvbiAoY2FjaGVOYW1lKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZU5hbWUuc3RhcnRzV2l0aCgncmVzLXJldi0nKSAmJiAhYWxsQ2FjaGVzLmluY2x1ZGVzKGNhY2hlTmFtZSk7XHJcbiAgICB9KS5tYXAoZnVuY3Rpb24gKGNhY2hlTmFtZSkge1xyXG4gICAgICByZXR1cm4gY2FjaGVzWydkZWxldGUnXShjYWNoZU5hbWUpO1xyXG4gICAgfSkpO1xyXG4gIH0pKTtcclxufSk7XHJcblxyXG5zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2ZldGNoJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICBjb25zdCByZXF1ZXN0VXJsID0gbmV3IFVSTChldmVudC5yZXF1ZXN0LnVybCk7XHJcblxyXG4gIC8vaWYgdGhlIHJlcXVlc3QgdXJsIGhhcyBwb3J0IDEzMzcsIHdlIGtub3cgaXQncyBhbiBpZGIgY2FsbC5cclxuICBpZihyZXF1ZXN0VXJsLnBvcnQgPT0gMTMzNyl7XHJcblxyXG4gICAgbGV0IGlkID0gZXZlbnQucmVxdWVzdC51cmwuc3Vic3RyaW5nKGV2ZW50LnJlcXVlc3QudXJsLmxhc3RJbmRleE9mKCcvJykgKyAxKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZygnc2VydmljZSBjYWxsJywgcmVxdWVzdFVybCwgaWQpO1xyXG5cclxuICAgIGlmKHJlcXVlc3RVcmwuc2VhcmNoWzBdID09ICc/Jyl7XHJcblxyXG5cclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKCdoZXkgbG9vaywgYSB0b2tlbicsIHJlcXVlc3RVcmwuc2VhcmNoWzBdKTtcclxuXHJcbiAgICAgIGNvbnNvbGUubG9nKCdidXQgd2hhdCB0b2tlbicsIHJlcXVlc3RVcmwuc2VhcmNoUGFyYW1zLmdldCgncmVzdGF1cmFudF9pZCcpLCByZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ2lzX2Zhdm9yaXRlJykpO1xyXG4gICAgICBjb25zb2xlLmxvZygnaWQgZm9yIHJldmlld3MgZmlyc3Q/JyxwYXJzZUludChyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc3RhdXJhbnRfaWQnKSwxMCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGlkID09IFwicmVzdGF1cmFudHNcIil7IC8vaW5kZXhcclxuXHJcbiAgICAgICAgcmV0dXJuIGhhbmRsZUluZGV4KGV2ZW50LHJlcXVlc3RVcmwpO1xyXG5cclxuICAgICAgfSBlbHNlIHsgLy9yZXN0YXVyYW50LCByZXZpZXcsIG9yIGZhdm9yaXRlXHJcblxyXG4gICAgICAgIGlkID0gcGFyc2VJbnQoaWQsMTApO1xyXG5cclxuICAgICAgICBpZihyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc3RhdXJhbnRfaWQnKSl7XHJcbiAgICAgICAgICBpZCA9IHBhcnNlSW50KHJlcXVlc3RVcmwuc2VhcmNoUGFyYW1zLmdldCgncmVzdGF1cmFudF9pZCcpLDEwKTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKCdtYWtpbmcgYSBjYWxsIGZvciByZXZpZXdzJywgZXZlbnQsIHJlcXVlc3RVcmwsIGlkKTtcclxuICAgICAgICAgIHJldHVybiBoYW5kbGVSZXZpZXcoZXZlbnQscmVxdWVzdFVybCxpZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ2lzX2Zhdm9yaXRlJykpe1xyXG4gICAgICAgICAgaWQgPSBwYXJzZUludChyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc3RhdXJhbnRfaWQnKSwxMCk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnbWFraW5nIGEgY2FsbCBmb3IgZmF2b3JpdGVzJywgZXZlbnQsIHJlcXVlc3RVcmwsIGlkKTtcclxuICAgICAgICAgIHJldHVybjsgLy90aGlzIGlzIGhhbmRsZWQgYnkgdGhlIGJ1dHRvbi4uLlxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGhhbmRsZVJlc3RhdXJhbnQoZXZlbnQscmVxdWVzdFVybCxpZCk7XHJcbiAgICAgIH1cclxuXHJcbiAgfSBlbHNlIHsgLy9vdGhlcndpc2UsIHVzZSBjYWNoZVxyXG5cclxuICAgIHJldHVybiBoYW5kbGVDYWNoZShldmVudCwgcmVxdWVzdFVybCk7XHJcblxyXG4gIH1cclxuXHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gaGFuZGxlSW5kZXgoZXZlbnQscmVxdWVzdFVybCl7XHJcbiAgZXZlbnQucmVzcG9uZFdpdGgoXHJcbiAgICBkYlByb21pc2UudGhlbihmdW5jdGlvbihkYikge1xyXG4gICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbigncmVzdGF1cmFudHMnLCAncmVhZG9ubHknKTtcclxuICAgICAgdmFyIHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXQoLTEpO1xyXG5cclxuICAgIH0pLnRoZW4oZnVuY3Rpb24oaXRlbSkge1xyXG5cclxuICAgICAgcmV0dXJuIGl0ZW0gfHwgZmV0Y2goZXZlbnQucmVxdWVzdClcclxuXHJcbiAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2Upe1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgICAudGhlbihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbihmdW5jdGlvbiAoZGIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyZXN0YXVyYW50c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyZXN0YXVyYW50c1wiKTtcclxuICAgICAgICAgICAgICAgIHN0b3JlLnB1dCh7aWQ6IC0xLCBkYXRhOiBqc29ufSk7XHJcblxyXG4gICAgICAgICAgICAgICAganNvbi5mb3JFYWNoKGZ1bmN0aW9uKHJlc3RhdXJhbnQpe1xyXG4gICAgICAgICAgICAgICAgICBzdG9yZS5wdXQoe2lkOiByZXN0YXVyYW50LmlkLCBkYXRhOiByZXN0YXVyYW50fSk7XHJcbiAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgIHJldHVybiBqc29uO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KS50aGVuKGZ1bmN0aW9uKGV2ZW50dWFsUmVzcG9uc2Upe1xyXG4gICAgICBjb25zb2xlLmxvZygnZXInLCBldmVudHVhbFJlc3BvbnNlKTtcclxuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShldmVudHVhbFJlc3BvbnNlLmRhdGEpKTtcclxuICAgIH0pXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaGFuZGxlUmVzdGF1cmFudChldmVudCxyZXF1ZXN0VXJsLGlkKXtcclxuICBldmVudC5yZXNwb25kV2l0aChcclxuICAgIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRiKSB7XHJcblxyXG4gICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbigncmVzdGF1cmFudHMnLCAncmVhZG9ubHknKTtcclxuICAgICAgdmFyIHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXQoTnVtYmVyKGlkKSk7XHJcblxyXG4gICAgfSkudGhlbihmdW5jdGlvbihpdGVtKSB7XHJcblxyXG4gICAgICByZXR1cm4gaXRlbSB8fCBmZXRjaChldmVudC5yZXF1ZXN0KVxyXG5cclxuXHJcbiAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2Upe1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVzcG9uc2UnLCByZXNwb25zZSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uIChkYikge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyZXN0YXVyYW50c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicmVzdGF1cmFudHNcIik7XHJcbiAgICAgICAgICAgICAgc3RvcmUucHV0KHtpZDogaWQsIGRhdGE6IGpzb259KTtcclxuICAgICAgICAgICAgICByZXR1cm4ganNvbjtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSkudGhlbihmdW5jdGlvbihldmVudHVhbFJlc3BvbnNlKXtcclxuICAgICAgY29uc29sZS5sb2coJ2VyJywgZXZlbnR1YWxSZXNwb25zZSk7XHJcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnR1YWxSZXNwb25zZS5kYXRhKSk7XHJcbiAgICB9KVxyXG4gICk7XHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gaGFuZGxlUmV2aWV3KGV2ZW50LHJlcXVlc3RVcmwsaWQpe1xyXG4gIGV2ZW50LnJlc3BvbmRXaXRoKFxyXG4gICAgZGJQcm9taXNlLnRoZW4oZnVuY3Rpb24oZGIpIHtcclxuXHJcbiAgICAgIHZhciB0eCA9IGRiLnRyYW5zYWN0aW9uKCdyZXZpZXdzJywgJ3JlYWRvbmx5Jyk7XHJcbiAgICAgIHZhciBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdyZXZpZXdzJyk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXQoaWQpO1xyXG5cclxuICAgIH0pLnRoZW4oZnVuY3Rpb24oaXRlbSkge1xyXG5cclxuICAgICAgcmV0dXJuIGl0ZW0gfHwgZmV0Y2goZXZlbnQucmVxdWVzdClcclxuXHJcbiAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2Upe1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVzcG9uc2UnLCByZXNwb25zZSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uIChkYikge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oXCJyZXZpZXdzXCIsIFwicmVhZHdyaXRlXCIpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJyZXZpZXdzXCIpO1xyXG4gICAgICAgICAgICAgIHN0b3JlLnB1dCh7aWQ6IGlkLCBkYXRhOiBqc29ufSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGpzb247XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pLnRoZW4oZnVuY3Rpb24oZXZlbnR1YWxSZXNwb25zZSl7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdlci1yZXZpZXdzJywgZXZlbnR1YWxSZXNwb25zZSk7XHJcbiAgICAgIGlmKGV2ZW50dWFsUmVzcG9uc2UuaWQpe1xyXG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnR1YWxSZXNwb25zZS5kYXRhKSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShldmVudHVhbFJlc3BvbnNlKSk7XHJcbiAgICB9KVxyXG4gICk7XHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gaGFuZGxlQ2FjaGUoZXZlbnQsIHJlcXVlc3RVcmwpe1xyXG5cclxuICAgIGlmIChyZXF1ZXN0VXJsLm9yaWdpbiA9PT0gbG9jYXRpb24ub3JpZ2luKSB7XHJcbiAgICAgIGlmIChyZXF1ZXN0VXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9pbWcvJykpIHtcclxuICAgICAgICBldmVudC5yZXNwb25kV2l0aChzZXJ2ZVBob3RvKGV2ZW50LnJlcXVlc3QpKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBldmVudC5yZXNwb25kV2l0aChcclxuICAgICAgY2FjaGVzLm1hdGNoKGV2ZW50LnJlcXVlc3QpLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xyXG4gICAgICAgIHJldHVybiByZXNwIHx8IGZldGNoKGV2ZW50LnJlcXVlc3QpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgIGxldCByZXNwb25zZUNsb25lID0gcmVzcG9uc2UuY2xvbmUoKTtcclxuICAgICAgICAgIGNhY2hlcy5vcGVuKHN0YXRpY0NhY2hlTmFtZSkudGhlbihmdW5jdGlvbihjYWNoZSkge1xyXG4gICAgICAgICAgICBjYWNoZS5wdXQoZXZlbnQucmVxdWVzdCwgcmVzcG9uc2VDbG9uZSk7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGVycm9yKSwge1xyXG4gICAgICAgICAgICBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ31cclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcnZlUGhvdG8ocmVxdWVzdCkge1xyXG4gIHZhciBzdG9yYWdlVXJsID0gcmVxdWVzdC51cmwucmVwbGFjZSgvLVxcZCtweFxcLmpwZyQvLCAnJyk7XHJcblxyXG4gIHJldHVybiBjYWNoZXMub3Blbihjb250ZW50SW1nc0NhY2hlKS50aGVuKGZ1bmN0aW9uIChjYWNoZSkge1xyXG4gICAgcmV0dXJuIGNhY2hlLm1hdGNoKHN0b3JhZ2VVcmwpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XHJcbiAgICAgIGlmIChyZXNwb25zZSkgcmV0dXJuIHJlc3BvbnNlO1xyXG5cclxuICAgICAgcmV0dXJuIGZldGNoKHJlcXVlc3QpLnRoZW4oZnVuY3Rpb24gKG5ldHdvcmtSZXNwb25zZSkge1xyXG4gICAgICAgIGNhY2hlLnB1dChzdG9yYWdlVXJsLCBuZXR3b3JrUmVzcG9uc2UuY2xvbmUoKSk7XHJcbiAgICAgICAgcmV0dXJuIG5ldHdvcmtSZXNwb25zZTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxufSIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiB0b0FycmF5KGFycikge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHJlcXVlc3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3QgPSBvYmpbbWV0aG9kXS5hcHBseShvYmosIGFyZ3MpO1xuICAgICAgcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfSk7XG5cbiAgICBwLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHJldHVybiBwO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKTtcbiAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgcC5yZXF1ZXN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UHJvcGVydGllcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShQcm94eUNsYXNzLnByb3RvdHlwZSwgcHJvcCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdLmFwcGx5KHRoaXNbdGFyZ2V0UHJvcF0sIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIEluZGV4KGluZGV4KSB7XG4gICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhJbmRleCwgJ19pbmRleCcsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdtdWx0aUVudHJ5JyxcbiAgICAndW5pcXVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnZ2V0JyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIEN1cnNvcihjdXJzb3IsIHJlcXVlc3QpIHtcbiAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3Q7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoQ3Vyc29yLCAnX2N1cnNvcicsIFtcbiAgICAnZGlyZWN0aW9uJyxcbiAgICAna2V5JyxcbiAgICAncHJpbWFyeUtleScsXG4gICAgJ3ZhbHVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEN1cnNvciwgJ19jdXJzb3InLCBJREJDdXJzb3IsIFtcbiAgICAndXBkYXRlJyxcbiAgICAnZGVsZXRlJ1xuICBdKTtcblxuICAvLyBwcm94eSAnbmV4dCcgbWV0aG9kc1xuICBbJ2FkdmFuY2UnLCAnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5J10uZm9yRWFjaChmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgaWYgKCEobWV0aG9kTmFtZSBpbiBJREJDdXJzb3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgIEN1cnNvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgY3Vyc29yLl9jdXJzb3JbbWV0aG9kTmFtZV0uYXBwbHkoY3Vyc29yLl9jdXJzb3IsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChjdXJzb3IuX3JlcXVlc3QpLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIGN1cnNvci5fcmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gT2JqZWN0U3RvcmUoc3RvcmUpIHtcbiAgICB0aGlzLl9zdG9yZSA9IHN0b3JlO1xuICB9XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmNyZWF0ZUluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5jcmVhdGVJbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5pbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ2luZGV4TmFtZXMnLFxuICAgICdhdXRvSW5jcmVtZW50J1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAncHV0JyxcbiAgICAnYWRkJyxcbiAgICAnZGVsZXRlJyxcbiAgICAnY2xlYXInLFxuICAgICdnZXQnLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnZGVsZXRlSW5kZXgnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFRyYW5zYWN0aW9uKGlkYlRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fdHggPSBpZGJUcmFuc2FjdGlvbjtcbiAgICB0aGlzLmNvbXBsZXRlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIFRyYW5zYWN0aW9uLnByb3RvdHlwZS5vYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fdHgub2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fdHgsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhUcmFuc2FjdGlvbiwgJ190eCcsIFtcbiAgICAnb2JqZWN0U3RvcmVOYW1lcycsXG4gICAgJ21vZGUnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhUcmFuc2FjdGlvbiwgJ190eCcsIElEQlRyYW5zYWN0aW9uLCBbXG4gICAgJ2Fib3J0J1xuICBdKTtcblxuICBmdW5jdGlvbiBVcGdyYWRlREIoZGIsIG9sZFZlcnNpb24sIHRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgICB0aGlzLm9sZFZlcnNpb24gPSBvbGRWZXJzaW9uO1xuICAgIHRoaXMudHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24odHJhbnNhY3Rpb24pO1xuICB9XG5cbiAgVXBncmFkZURCLnByb3RvdHlwZS5jcmVhdGVPYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fZGIuY3JlYXRlT2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhVcGdyYWRlREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFVwZ3JhZGVEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2RlbGV0ZU9iamVjdFN0b3JlJyxcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIERCKGRiKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgfVxuXG4gIERCLnByb3RvdHlwZS50cmFuc2FjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgVHJhbnNhY3Rpb24odGhpcy5fZGIudHJhbnNhY3Rpb24uYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgLy8gQWRkIGN1cnNvciBpdGVyYXRvcnNcbiAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgb25jZSBicm93c2VycyBkbyB0aGUgcmlnaHQgdGhpbmcgd2l0aCBwcm9taXNlc1xuICBbJ29wZW5DdXJzb3InLCAnb3BlbktleUN1cnNvciddLmZvckVhY2goZnVuY3Rpb24oZnVuY05hbWUpIHtcbiAgICBbT2JqZWN0U3RvcmUsIEluZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgICAvLyBEb24ndCBjcmVhdGUgaXRlcmF0ZUtleUN1cnNvciBpZiBvcGVuS2V5Q3Vyc29yIGRvZXNuJ3QgZXhpc3QuXG4gICAgICBpZiAoIShmdW5jTmFtZSBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG5cbiAgICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZVtmdW5jTmFtZS5yZXBsYWNlKCdvcGVuJywgJ2l0ZXJhdGUnKV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcbiAgICAgICAgdmFyIG5hdGl2ZU9iamVjdCA9IHRoaXMuX3N0b3JlIHx8IHRoaXMuX2luZGV4O1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5hdGl2ZU9iamVjdFtmdW5jTmFtZV0uYXBwbHkobmF0aXZlT2JqZWN0LCBhcmdzLnNsaWNlKDAsIC0xKSk7XG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FsbGJhY2socmVxdWVzdC5yZXN1bHQpO1xuICAgICAgICB9O1xuICAgICAgfTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gcG9seWZpbGwgZ2V0QWxsXG4gIFtJbmRleCwgT2JqZWN0U3RvcmVdLmZvckVhY2goZnVuY3Rpb24oQ29uc3RydWN0b3IpIHtcbiAgICBpZiAoQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCkgcmV0dXJuO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbihxdWVyeSwgY291bnQpIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXM7XG4gICAgICB2YXIgaXRlbXMgPSBbXTtcblxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgICAgaW5zdGFuY2UuaXRlcmF0ZUN1cnNvcihxdWVyeSwgZnVuY3Rpb24oY3Vyc29yKSB7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdGVtcy5wdXNoKGN1cnNvci52YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoY291bnQgIT09IHVuZGVmaW5lZCAmJiBpdGVtcy5sZW5ndGggPT0gY291bnQpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICB2YXIgZXhwID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKG5hbWUsIHZlcnNpb24sIHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdvcGVuJywgW25hbWUsIHZlcnNpb25dKTtcbiAgICAgIHZhciByZXF1ZXN0ID0gcC5yZXF1ZXN0O1xuXG4gICAgICBpZiAocmVxdWVzdCkge1xuICAgICAgICByZXF1ZXN0Lm9udXBncmFkZW5lZWRlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgICAgICAgdXBncmFkZUNhbGxiYWNrKG5ldyBVcGdyYWRlREIocmVxdWVzdC5yZXN1bHQsIGV2ZW50Lm9sZFZlcnNpb24sIHJlcXVlc3QudHJhbnNhY3Rpb24pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24oZGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEQihkYik7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ2RlbGV0ZURhdGFiYXNlJywgW25hbWVdKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBleHA7XG4gICAgbW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1vZHVsZS5leHBvcnRzO1xuICB9XG4gIGVsc2Uge1xuICAgIHNlbGYuaWRiID0gZXhwO1xuICB9XG59KCkpO1xuIl19
