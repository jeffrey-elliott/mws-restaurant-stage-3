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
    '/css/styles.css', '/css/media.css', '/css/media-info.css', '/img/back.svg', '/img/star.svg', '/js/dbhelper.js', '/js/main.js', '/js/restaurant_info.js', '/js/idb.js']);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvc3cuanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0VBOzs7O0FBRkE7QUFJQSxJQUFJLFNBQVMsR0FBRyxhQUFJLElBQUosQ0FBUyxtQkFBVCxFQUE4QixDQUE5QixFQUFpQyxVQUFTLFNBQVQsRUFBb0I7QUFFakUsTUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBVixDQUEyQixRQUEzQixDQUFvQyxhQUFwQyxDQUFMLEVBQXlEO0FBQ3ZELFFBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixhQUE1QixFQUEyQztBQUFDLE1BQUEsT0FBTyxFQUFFO0FBQVYsS0FBM0MsQ0FBVDtBQUNBLFFBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixTQUE1QixFQUF1QztBQUFDLE1BQUEsT0FBTyxFQUFFO0FBQVYsS0FBdkMsRUFDRSxXQURGLENBQ2MsZUFEZCxFQUMrQixlQUQvQixDQUFUO0FBRUQ7QUFFRixDQVJhLENBQWhCOztBQVVBLElBQUksZUFBZSxHQUFHLG1CQUF0QjtBQUNBLElBQUksZ0JBQWdCLEdBQUcseUJBQXZCO0FBQ0EsSUFBSSxTQUFTLEdBQUcsQ0FBQyxlQUFELEVBQWtCLGdCQUFsQixDQUFoQjtBQUVBLElBQUksQ0FBQyxnQkFBTCxDQUFzQixTQUF0QixFQUFpQyxVQUFTLEtBQVQsRUFBZ0I7QUFDL0MsRUFBQSxLQUFLLENBQUMsU0FBTixDQUNFLE1BQU0sQ0FBQyxJQUFQLENBQVksZUFBWixFQUE2QixJQUE3QixDQUFrQyxVQUFTLEtBQVQsRUFBZ0I7QUFDaEQsV0FBTyxLQUFLLENBQUMsTUFBTixDQUFhLENBQ2xCLEdBRGtCLEVBRWxCLGdCQUZrQixFQUVBO0FBQ2xCLHFCQUhrQixFQUlsQixnQkFKa0IsRUFLbEIscUJBTGtCLEVBTWxCLGVBTmtCLEVBT2xCLGVBUGtC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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLypqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcblxyXG5pbXBvcnQgaWRiIGZyb20gJ2lkYic7XHJcblxyXG52YXIgZGJQcm9taXNlID0gaWRiLm9wZW4oJ2RiLXVkYWNpdHktbXdzLXJyJywgMSwgZnVuY3Rpb24odXBncmFkZURiKSB7XHJcblxyXG4gICAgaWYgKCF1cGdyYWRlRGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucygncmVzdGF1cmFudHMnKSkge1xyXG4gICAgICBsZXQgcnIgPSB1cGdyYWRlRGIuY3JlYXRlT2JqZWN0U3RvcmUoJ3Jlc3RhdXJhbnRzJywge2tleVBhdGg6ICdpZCd9KTtcclxuICAgICAgbGV0IHJ2ID0gdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXZpZXdzJywge2tleVBhdGg6ICdpZCd9KVxyXG4gICAgICAgICAgICAgICAgLmNyZWF0ZUluZGV4KCdyZXN0YXVyYW50X2lkJywgJ3Jlc3RhdXJhbnRfaWQnKTtcclxuICAgIH1cclxuXHJcbiAgfSk7XHJcblxyXG52YXIgc3RhdGljQ2FjaGVOYW1lID0gJ3Jlcy1yZXYtc3RhdGljLXY1JztcclxudmFyIGNvbnRlbnRJbWdzQ2FjaGUgPSAncmVzLXJldi1jb250ZW50LWltZ3MtdjInO1xyXG52YXIgYWxsQ2FjaGVzID0gW3N0YXRpY0NhY2hlTmFtZSwgY29udGVudEltZ3NDYWNoZV07XHJcblxyXG5zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2luc3RhbGwnLCBmdW5jdGlvbihldmVudCkge1xyXG4gIGV2ZW50LndhaXRVbnRpbChcclxuICAgIGNhY2hlcy5vcGVuKHN0YXRpY0NhY2hlTmFtZSkudGhlbihmdW5jdGlvbihjYWNoZSkge1xyXG4gICAgICByZXR1cm4gY2FjaGUuYWRkQWxsKFtcclxuICAgICAgICAnLycsXHJcbiAgICAgICAgJy9tYW5pZmVzdC5qc29uJywgLy9odHRwczovL2dpdGh1Yi5jb20vR29vZ2xlQ2hyb21lL2xpZ2h0aG91c2UvaXNzdWVzLzI1NzZcclxuICAgICAgICAnL2Nzcy9zdHlsZXMuY3NzJyxcclxuICAgICAgICAnL2Nzcy9tZWRpYS5jc3MnLFxyXG4gICAgICAgICcvY3NzL21lZGlhLWluZm8uY3NzJyxcclxuICAgICAgICAnL2ltZy9iYWNrLnN2ZycsXHJcbiAgICAgICAgJy9pbWcvc3Rhci5zdmcnLFxyXG4gICAgICAgICcvanMvZGJoZWxwZXIuanMnLFxyXG4gICAgICAgICcvanMvbWFpbi5qcycsXHJcbiAgICAgICAgJy9qcy9yZXN0YXVyYW50X2luZm8uanMnLFxyXG4gICAgICAgICcvanMvaWRiLmpzJ1xyXG4gICAgICBdKTtcclxuICAgIH0pXHJcbiAgKTtcclxufSk7XHJcblxyXG5cclxuXHJcbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignYWN0aXZhdGUnLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICBldmVudC53YWl0VW50aWwoY2FjaGVzLmtleXMoKS50aGVuKGZ1bmN0aW9uIChjYWNoZU5hbWVzKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoY2FjaGVOYW1lcy5maWx0ZXIoZnVuY3Rpb24gKGNhY2hlTmFtZSkge1xyXG4gICAgICByZXR1cm4gY2FjaGVOYW1lLnN0YXJ0c1dpdGgoJ3Jlcy1yZXYtJykgJiYgIWFsbENhY2hlcy5pbmNsdWRlcyhjYWNoZU5hbWUpO1xyXG4gICAgfSkubWFwKGZ1bmN0aW9uIChjYWNoZU5hbWUpIHtcclxuICAgICAgcmV0dXJuIGNhY2hlc1snZGVsZXRlJ10oY2FjaGVOYW1lKTtcclxuICAgIH0pKTtcclxuICB9KSk7XHJcbn0pO1xyXG5cclxuc2VsZi5hZGRFdmVudExpc3RlbmVyKCdmZXRjaCcsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwoZXZlbnQucmVxdWVzdC51cmwpO1xyXG5cclxuICAvL2lmIHRoZSByZXF1ZXN0IHVybCBoYXMgcG9ydCAxMzM3LCB3ZSBrbm93IGl0J3MgYW4gaWRiIGNhbGwuXHJcbiAgaWYocmVxdWVzdFVybC5wb3J0ID09IDEzMzcpe1xyXG5cclxuICAgIGxldCBpZCA9IGV2ZW50LnJlcXVlc3QudXJsLnN1YnN0cmluZyhldmVudC5yZXF1ZXN0LnVybC5sYXN0SW5kZXhPZignLycpICsgMSk7XHJcblxyXG4gICAgY29uc29sZS5sb2coJ3NlcnZpY2UgY2FsbCcsIHJlcXVlc3RVcmwsIGlkKTtcclxuXHJcbiAgICBpZihyZXF1ZXN0VXJsLnNlYXJjaFswXSA9PSAnPycpe1xyXG5cclxuXHJcblxyXG4gICAgICBjb25zb2xlLmxvZygnaGV5IGxvb2ssIGEgdG9rZW4nLCByZXF1ZXN0VXJsLnNlYXJjaFswXSk7XHJcblxyXG4gICAgICBjb25zb2xlLmxvZygnYnV0IHdoYXQgdG9rZW4nLCByZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc3RhdXJhbnRfaWQnKSwgcmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KCdpc19mYXZvcml0ZScpKTtcclxuICAgICAgY29uc29sZS5sb2coJ2lkIGZvciByZXZpZXdzIGZpcnN0PycscGFyc2VJbnQocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KCdyZXN0YXVyYW50X2lkJyksMTApKTtcclxuICAgIH1cclxuXHJcbiAgICBpZihpZCA9PSBcInJlc3RhdXJhbnRzXCIpeyAvL2luZGV4XHJcblxyXG4gICAgICAgIHJldHVybiBoYW5kbGVJbmRleChldmVudCxyZXF1ZXN0VXJsKTtcclxuXHJcbiAgICAgIH0gZWxzZSB7IC8vcmVzdGF1cmFudCwgcmV2aWV3LCBvciBmYXZvcml0ZVxyXG5cclxuICAgICAgICBpZCA9IHBhcnNlSW50KGlkLDEwKTtcclxuXHJcbiAgICAgICAgaWYocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KCdyZXN0YXVyYW50X2lkJykpe1xyXG4gICAgICAgICAgaWQgPSBwYXJzZUludChyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc3RhdXJhbnRfaWQnKSwxMCk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnbWFraW5nIGEgY2FsbCBmb3IgcmV2aWV3cycsIGV2ZW50LCByZXF1ZXN0VXJsLCBpZCk7XHJcbiAgICAgICAgICByZXR1cm4gaGFuZGxlUmV2aWV3KGV2ZW50LHJlcXVlc3RVcmwsaWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KCdpc19mYXZvcml0ZScpKXtcclxuICAgICAgICAgIGlkID0gcGFyc2VJbnQocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KCdyZXN0YXVyYW50X2lkJyksMTApO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coJ21ha2luZyBhIGNhbGwgZm9yIGZhdm9yaXRlcycsIGV2ZW50LCByZXF1ZXN0VXJsLCBpZCk7XHJcbiAgICAgICAgICByZXR1cm4gOy8vdGhpcyBpcyBoYW5kbGVkIGJ5IHRoZSBidXR0b24uLi5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBoYW5kbGVSZXN0YXVyYW50KGV2ZW50LHJlcXVlc3RVcmwsaWQpO1xyXG4gICAgICB9XHJcblxyXG4gIH0gZWxzZSB7IC8vb3RoZXJ3aXNlLCB1c2UgY2FjaGVcclxuXHJcbiAgICByZXR1cm4gaGFuZGxlQ2FjaGUoZXZlbnQsIHJlcXVlc3RVcmwpO1xyXG5cclxuICB9XHJcblxyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGhhbmRsZUluZGV4KGV2ZW50LHJlcXVlc3RVcmwpe1xyXG4gIGV2ZW50LnJlc3BvbmRXaXRoKFxyXG4gICAgZGJQcm9taXNlLnRoZW4oZnVuY3Rpb24oZGIpIHtcclxuICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ3Jlc3RhdXJhbnRzJywgJ3JlYWRvbmx5Jyk7XHJcbiAgICAgIHZhciBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdyZXN0YXVyYW50cycpO1xyXG4gICAgICByZXR1cm4gc3RvcmUuZ2V0KC0xKTtcclxuXHJcbiAgICB9KS50aGVuKGZ1bmN0aW9uKGl0ZW0pIHtcclxuXHJcbiAgICAgIHJldHVybiBpdGVtIHx8IGZldGNoKGV2ZW50LnJlcXVlc3QpXHJcblxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKXtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcclxuICAgICAgICAgIH0pXHJcblxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgICByZXR1cm4gZGJQcm9taXNlLnRoZW4oZnVuY3Rpb24gKGRiKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicmVzdGF1cmFudHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicmVzdGF1cmFudHNcIik7XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5wdXQoe2lkOiAtMSwgZGF0YToganNvbn0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGpzb24uZm9yRWFjaChmdW5jdGlvbihyZXN0YXVyYW50KXtcclxuICAgICAgICAgICAgICAgICAgc3RvcmUucHV0KHtpZDogcmVzdGF1cmFudC5pZCwgZGF0YTogcmVzdGF1cmFudH0pO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICByZXR1cm4ganNvbjtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSkudGhlbihmdW5jdGlvbihldmVudHVhbFJlc3BvbnNlKXtcclxuICAgICAgY29uc29sZS5sb2coJ2VyJywgZXZlbnR1YWxSZXNwb25zZSk7XHJcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnR1YWxSZXNwb25zZS5kYXRhKSk7XHJcbiAgICB9KVxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZVJlc3RhdXJhbnQoZXZlbnQscmVxdWVzdFVybCxpZCl7XHJcbiAgZXZlbnQucmVzcG9uZFdpdGgoXHJcbiAgICBkYlByb21pc2UudGhlbihmdW5jdGlvbihkYikge1xyXG5cclxuICAgICAgdmFyIHR4ID0gZGIudHJhbnNhY3Rpb24oJ3Jlc3RhdXJhbnRzJywgJ3JlYWRvbmx5Jyk7XHJcbiAgICAgIHZhciBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKCdyZXN0YXVyYW50cycpO1xyXG4gICAgICByZXR1cm4gc3RvcmUuZ2V0KE51bWJlcihpZCkpO1xyXG5cclxuICAgIH0pLnRoZW4oZnVuY3Rpb24oaXRlbSkge1xyXG5cclxuICAgICAgcmV0dXJuIGl0ZW0gfHwgZmV0Y2goZXZlbnQucmVxdWVzdClcclxuXHJcblxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKXtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlc3BvbnNlJywgcmVzcG9uc2UpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbihmdW5jdGlvbiAoZGIpIHtcclxuICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicmVzdGF1cmFudHNcIiwgXCJyZWFkd3JpdGVcIik7XHJcbiAgICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShcInJlc3RhdXJhbnRzXCIpO1xyXG4gICAgICAgICAgICAgIHN0b3JlLnB1dCh7aWQ6IGlkLCBkYXRhOiBqc29ufSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGpzb247XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pLnRoZW4oZnVuY3Rpb24oZXZlbnR1YWxSZXNwb25zZSl7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdlcicsIGV2ZW50dWFsUmVzcG9uc2UpO1xyXG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGV2ZW50dWFsUmVzcG9uc2UuZGF0YSkpO1xyXG4gICAgfSlcclxuICApO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZVJldmlldyhldmVudCxyZXF1ZXN0VXJsLGlkKXtcclxuICBldmVudC5yZXNwb25kV2l0aChcclxuICAgIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRiKSB7XHJcblxyXG4gICAgICB2YXIgdHggPSBkYi50cmFuc2FjdGlvbigncmV2aWV3cycsICdyZWFkb25seScpO1xyXG4gICAgICB2YXIgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncmV2aWV3cycpO1xyXG4gICAgICByZXR1cm4gc3RvcmUuZ2V0KGlkKTtcclxuXHJcbiAgICB9KS50aGVuKGZ1bmN0aW9uKGl0ZW0pIHtcclxuXHJcbiAgICAgIHJldHVybiBpdGVtIHx8IGZldGNoKGV2ZW50LnJlcXVlc3QpXHJcblxyXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKXtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlc3BvbnNlJywgcmVzcG9uc2UpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkYlByb21pc2UudGhlbihmdW5jdGlvbiAoZGIpIHtcclxuICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFwicmV2aWV3c1wiLCBcInJlYWR3cml0ZVwiKTtcclxuICAgICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFwicmV2aWV3c1wiKTtcclxuICAgICAgICAgICAgICBzdG9yZS5wdXQoe2lkOiBpZCwgZGF0YToganNvbn0pO1xyXG4gICAgICAgICAgICAgIHJldHVybiBqc29uO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KS50aGVuKGZ1bmN0aW9uKGV2ZW50dWFsUmVzcG9uc2Upe1xyXG4gICAgICBjb25zb2xlLmxvZygnZXItcmV2aWV3cycsIGV2ZW50dWFsUmVzcG9uc2UpO1xyXG4gICAgICBpZihldmVudHVhbFJlc3BvbnNlLmlkKXtcclxuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGV2ZW50dWFsUmVzcG9uc2UuZGF0YSkpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnR1YWxSZXNwb25zZSkpO1xyXG4gICAgfSlcclxuICApO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZUNhY2hlKGV2ZW50LCByZXF1ZXN0VXJsKXtcclxuXHJcbiAgICBpZiAocmVxdWVzdFVybC5vcmlnaW4gPT09IGxvY2F0aW9uLm9yaWdpbikge1xyXG4gICAgICBpZiAocmVxdWVzdFVybC5wYXRobmFtZS5zdGFydHNXaXRoKCcvaW1nLycpKSB7XHJcbiAgICAgICAgZXZlbnQucmVzcG9uZFdpdGgoc2VydmVQaG90byhldmVudC5yZXF1ZXN0KSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXZlbnQucmVzcG9uZFdpdGgoXHJcbiAgICAgIGNhY2hlcy5tYXRjaChldmVudC5yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcclxuICAgICAgICByZXR1cm4gcmVzcCB8fCBmZXRjaChldmVudC5yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICBsZXQgcmVzcG9uc2VDbG9uZSA9IHJlc3BvbnNlLmNsb25lKCk7XHJcbiAgICAgICAgICBjYWNoZXMub3BlbihzdGF0aWNDYWNoZU5hbWUpLnRoZW4oZnVuY3Rpb24oY2FjaGUpIHtcclxuICAgICAgICAgICAgY2FjaGUucHV0KGV2ZW50LnJlcXVlc3QsIHJlc3BvbnNlQ2xvbmUpO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShlcnJvciksIHtcclxuICAgICAgICAgICAgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJ2ZVBob3RvKHJlcXVlc3QpIHtcclxuICB2YXIgc3RvcmFnZVVybCA9IHJlcXVlc3QudXJsLnJlcGxhY2UoLy1cXGQrcHhcXC5qcGckLywgJycpO1xyXG5cclxuICByZXR1cm4gY2FjaGVzLm9wZW4oY29udGVudEltZ3NDYWNoZSkudGhlbihmdW5jdGlvbiAoY2FjaGUpIHtcclxuICAgIHJldHVybiBjYWNoZS5tYXRjaChzdG9yYWdlVXJsKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICBpZiAocmVzcG9uc2UpIHJldHVybiByZXNwb25zZTtcclxuXHJcbiAgICAgIHJldHVybiBmZXRjaChyZXF1ZXN0KS50aGVuKGZ1bmN0aW9uIChuZXR3b3JrUmVzcG9uc2UpIHtcclxuICAgICAgICBjYWNoZS5wdXQoc3RvcmFnZVVybCwgbmV0d29ya1Jlc3BvbnNlLmNsb25lKCkpO1xyXG4gICAgICAgIHJldHVybiBuZXR3b3JrUmVzcG9uc2U7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0iLCIndXNlIHN0cmljdCc7XG5cbihmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gdG9BcnJheShhcnIpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xuICAgICAgfTtcblxuICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciByZXF1ZXN0O1xuICAgIHZhciBwID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0ID0gb2JqW21ldGhvZF0uYXBwbHkob2JqLCBhcmdzKTtcbiAgICAgIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgIH0pO1xuXG4gICAgcC5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICByZXR1cm4gcDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncyk7XG4gICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIHAucmVxdWVzdCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVByb3BlcnRpZXMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUHJveHlDbGFzcy5wcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICB0aGlzW3RhcmdldFByb3BdW3Byb3BdID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eU1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXS5hcHBseSh0aGlzW3RhcmdldFByb3BdLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBJbmRleChpbmRleCkge1xuICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoSW5kZXgsICdfaW5kZXgnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnbXVsdGlFbnRyeScsXG4gICAgJ3VuaXF1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ2dldCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBmdW5jdGlvbiBDdXJzb3IoY3Vyc29yLCByZXF1ZXN0KSB7XG4gICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEN1cnNvciwgJ19jdXJzb3InLCBbXG4gICAgJ2RpcmVjdGlvbicsXG4gICAgJ2tleScsXG4gICAgJ3ByaW1hcnlLZXknLFxuICAgICd2YWx1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhDdXJzb3IsICdfY3Vyc29yJywgSURCQ3Vyc29yLCBbXG4gICAgJ3VwZGF0ZScsXG4gICAgJ2RlbGV0ZSdcbiAgXSk7XG5cbiAgLy8gcHJveHkgJ25leHQnIG1ldGhvZHNcbiAgWydhZHZhbmNlJywgJ2NvbnRpbnVlJywgJ2NvbnRpbnVlUHJpbWFyeUtleSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgIGlmICghKG1ldGhvZE5hbWUgaW4gSURCQ3Vyc29yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY3Vyc29yID0gdGhpcztcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGN1cnNvci5fY3Vyc29yW21ldGhvZE5hbWVdLmFwcGx5KGN1cnNvci5fY3Vyc29yLCBhcmdzKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3QoY3Vyc29yLl9yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBjdXJzb3IuX3JlcXVlc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIE9iamVjdFN0b3JlKHN0b3JlKSB7XG4gICAgdGhpcy5fc3RvcmUgPSBzdG9yZTtcbiAgfVxuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuY3JlYXRlSW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuaW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdpbmRleE5hbWVzJyxcbiAgICAnYXV0b0luY3JlbWVudCdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ3B1dCcsXG4gICAgJ2FkZCcsXG4gICAgJ2RlbGV0ZScsXG4gICAgJ2NsZWFyJyxcbiAgICAnZ2V0JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ2RlbGV0ZUluZGV4J1xuICBdKTtcblxuICBmdW5jdGlvbiBUcmFuc2FjdGlvbihpZGJUcmFuc2FjdGlvbikge1xuICAgIHRoaXMuX3R4ID0gaWRiVHJhbnNhY3Rpb247XG4gICAgdGhpcy5jb21wbGV0ZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBUcmFuc2FjdGlvbi5wcm90b3R5cGUub2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX3R4Lm9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX3R4LCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVHJhbnNhY3Rpb24sICdfdHgnLCBbXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnLFxuICAgICdtb2RlJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVHJhbnNhY3Rpb24sICdfdHgnLCBJREJUcmFuc2FjdGlvbiwgW1xuICAgICdhYm9ydCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVXBncmFkZURCKGRiLCBvbGRWZXJzaW9uLCB0cmFuc2FjdGlvbikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gICAgdGhpcy5vbGRWZXJzaW9uID0gb2xkVmVyc2lvbjtcbiAgICB0aGlzLnRyYW5zYWN0aW9uID0gbmV3IFRyYW5zYWN0aW9uKHRyYW5zYWN0aW9uKTtcbiAgfVxuXG4gIFVwZ3JhZGVEQi5wcm90b3R5cGUuY3JlYXRlT2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX2RiLmNyZWF0ZU9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVXBncmFkZURCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhVcGdyYWRlREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdkZWxldGVPYmplY3RTdG9yZScsXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICBmdW5jdGlvbiBEQihkYikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gIH1cblxuICBEQi5wcm90b3R5cGUudHJhbnNhY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKHRoaXMuX2RiLnRyYW5zYWN0aW9uLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKERCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIC8vIEFkZCBjdXJzb3IgaXRlcmF0b3JzXG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIG9uY2UgYnJvd3NlcnMgZG8gdGhlIHJpZ2h0IHRoaW5nIHdpdGggcHJvbWlzZXNcbiAgWydvcGVuQ3Vyc29yJywgJ29wZW5LZXlDdXJzb3InXS5mb3JFYWNoKGZ1bmN0aW9uKGZ1bmNOYW1lKSB7XG4gICAgW09iamVjdFN0b3JlLCBJbmRleF0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgICAgLy8gRG9uJ3QgY3JlYXRlIGl0ZXJhdGVLZXlDdXJzb3IgaWYgb3BlbktleUN1cnNvciBkb2Vzbid0IGV4aXN0LlxuICAgICAgaWYgKCEoZnVuY05hbWUgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuXG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGVbZnVuY05hbWUucmVwbGFjZSgnb3BlbicsICdpdGVyYXRlJyldID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBuYXRpdmVPYmplY3QgPSB0aGlzLl9zdG9yZSB8fCB0aGlzLl9pbmRleDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuYXRpdmVPYmplY3RbZnVuY05hbWVdLmFwcGx5KG5hdGl2ZU9iamVjdCwgYXJncy5zbGljZSgwLCAtMSkpO1xuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNhbGxiYWNrKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIHBvbHlmaWxsIGdldEFsbFxuICBbSW5kZXgsIE9iamVjdFN0b3JlXS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwpIHJldHVybjtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24ocXVlcnksIGNvdW50KSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xuICAgICAgdmFyIGl0ZW1zID0gW107XG5cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAgIGluc3RhbmNlLml0ZXJhdGVDdXJzb3IocXVlcnksIGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXRlbXMucHVzaChjdXJzb3IudmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGNvdW50ICE9PSB1bmRlZmluZWQgJiYgaXRlbXMubGVuZ3RoID09IGNvdW50KSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgdmFyIGV4cCA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihuYW1lLCB2ZXJzaW9uLCB1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnb3BlbicsIFtuYW1lLCB2ZXJzaW9uXSk7XG4gICAgICB2YXIgcmVxdWVzdCA9IHAucmVxdWVzdDtcblxuICAgICAgaWYgKHJlcXVlc3QpIHtcbiAgICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIGlmICh1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIHVwZ3JhZGVDYWxsYmFjayhuZXcgVXBncmFkZURCKHJlcXVlc3QucmVzdWx0LCBldmVudC5vbGRWZXJzaW9uLCByZXF1ZXN0LnRyYW5zYWN0aW9uKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKGRiKSB7XG4gICAgICAgIHJldHVybiBuZXcgREIoZGIpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWxldGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdkZWxldGVEYXRhYmFzZScsIFtuYW1lXSk7XG4gICAgfVxuICB9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZXhwO1xuICAgIG1vZHVsZS5leHBvcnRzLmRlZmF1bHQgPSBtb2R1bGUuZXhwb3J0cztcbiAgfVxuICBlbHNlIHtcbiAgICBzZWxmLmlkYiA9IGV4cDtcbiAgfVxufSgpKTtcbiJdfQ==
