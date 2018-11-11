/*jshint esversion: 6 */

import idb from 'idb';

var dbPromise = idb.open('db-udacity-mws-rr', 1, function(upgradeDb) {

    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
      let rr = upgradeDb.createObjectStore('restaurants', {keyPath: 'id'});
      let rv = upgradeDb.createObjectStore('reviews', {keyPath: 'id'})
                .createIndex('restaurant_id', 'restaurant_id');
    }

  });

var staticCacheName = 'res-rev-static-v5';
var contentImgsCache = 'res-rev-content-imgs-v2';
var allCaches = [staticCacheName, contentImgsCache];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/',
        '/manifest.json', //https://github.com/GoogleChrome/lighthouse/issues/2576
        '/css/styles.css',
        '/css/media.css',
        '/css/media-info.css',
        '/img/back.svg',
        '/img/star.svg',
        '/js/dbhelper.js',
        '/js/main.js',
        '/js/restaurant_info.js',
        '/js/idb.js'
      ]);
    })
  );
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

self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);

  //if the request url has port 1337, we know it's an idb call.
  if(requestUrl.port == 1337){

    let id = event.request.url.substring(event.request.url.lastIndexOf('/') + 1);

    console.log('service call', requestUrl, id);

    if(requestUrl.search[0] == '?'){



      console.log('hey look, a token', requestUrl.search[0]);

      console.log('but what token', requestUrl.searchParams.get('restaurant_id'), requestUrl.searchParams.get('is_favorite'));
      console.log('id for reviews first?',parseInt(requestUrl.searchParams.get('restaurant_id'),10));
    }

    if(id == "restaurants"){ //index

        return handleIndex(event,requestUrl);

      } else { //restaurant, review, or favorite

        id = parseInt(id,10);

        if(requestUrl.searchParams.get('restaurant_id')){
          id = parseInt(requestUrl.searchParams.get('restaurant_id'),10);
          console.log('making a call for reviews', event, requestUrl, id);
          return handleReview(event,requestUrl,id);
        }

        if(requestUrl.searchParams.get('is_favorite')){
          id = parseInt(requestUrl.searchParams.get('restaurant_id'),10);
          console.log('making a call for favorites', event, requestUrl, id);
          return ;//this is handled by the button...
        }

        return handleRestaurant(event,requestUrl,id);
      }

  } else { //otherwise, use cache

    return handleCache(event, requestUrl);

  }

});

function handleIndex(event,requestUrl){
  event.respondWith(
    dbPromise.then(function(db) {
      var tx = db.transaction('restaurants', 'readonly');
      var store = tx.objectStore('restaurants');
      return store.get(-1);

    }).then(function(item) {

      return item || fetch(event.request)

          .then(function (response){
            return response.json();
          })

          .then(function (json) {
              return dbPromise.then(function (db) {
                const tx = db.transaction("restaurants", "readwrite");
                const store = tx.objectStore("restaurants");
                store.put({id: -1, data: json});

                json.forEach(function(restaurant){
                  store.put({id: restaurant.id, data: restaurant});
              });

              return json;
          });
        });
    }).then(function(eventualResponse){
      console.log('er', eventualResponse);
      return new Response(JSON.stringify(eventualResponse.data));
    })
  );
}

function handleRestaurant(event,requestUrl,id){
  event.respondWith(
    dbPromise.then(function(db) {

      var tx = db.transaction('restaurants', 'readonly');
      var store = tx.objectStore('restaurants');
      return store.get(Number(id));

    }).then(function(item) {

      return item || fetch(event.request)


          .then(function (response){
            console.log('response', response);
            return response.json();
          })
          .then(function (json) {
            return dbPromise.then(function (db) {
              const tx = db.transaction("restaurants", "readwrite");
              const store = tx.objectStore("restaurants");
              store.put({id: id, data: json});
              return json;
          });
        });
    }).then(function(eventualResponse){
      console.log('er', eventualResponse);
      return new Response(JSON.stringify(eventualResponse.data));
    })
  );
}



function handleReview(event,requestUrl,id){
  event.respondWith(
    dbPromise.then(function(db) {

      var tx = db.transaction('reviews', 'readonly');
      var store = tx.objectStore('reviews');
      return store.get(id);

    }).then(function(item) {

      return item || fetch(event.request)

          .then(function (response){
            console.log('response', response);
            return response.json();
          })
          .then(function (json) {
            return dbPromise.then(function (db) {
              const tx = db.transaction("reviews", "readwrite");
              const store = tx.objectStore("reviews");
              store.put({id: id, data: json});
              return json;
          });
        });
    }).then(function(eventualResponse){
      console.log('er-reviews', eventualResponse);
      if(eventualResponse.id){
        return new Response(JSON.stringify(eventualResponse.data));
      }
      return new Response(JSON.stringify(eventualResponse));
    })
  );
}



function handleCache(event, requestUrl){

    if (requestUrl.origin === location.origin) {
      if (requestUrl.pathname.startsWith('/img/')) {
        event.respondWith(servePhoto(event.request));
        return;
      }
    }

    event.respondWith(
      caches.match(event.request).then(function(resp) {
        return resp || fetch(event.request).then(function(response) {
          let responseClone = response.clone();
          caches.open(staticCacheName).then(function(cache) {
            cache.put(event.request, responseClone);
          });

          return response;
        });
      }).catch(function(error) {
          return new Response(JSON.stringify(error), {
            headers: {'Content-Type': 'application/json'}
          });
      })
    );

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