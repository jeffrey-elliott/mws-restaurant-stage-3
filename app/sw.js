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
        '/js/idb.js',
        'favicon.ico'
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

  //port 1337 means an API call ...
  if(requestUrl.port == 1337){

    if(event.request.method == "POST" || event.request.method == "PUT"){
      // console.log('trying to',event.request.method );
      // return fetch(event.request)
      // .then(fetchResponse => fetchResponse.json())
      // .then(json => {
      //   return json;
      // });

    }

    // if(event.request.method == "POST"){
    //   let ref = new URL(event.request.referrer);
    //   let id = ref.searchParams.get('id');
    //   console.log('posted...trying to keep reviews up', event.request, id);
    //   return handleReviews(event,requestUrl,parseInt(id,10));
    // }

    if(requestUrl.searchParams.get('restaurant_id')){
      console.log('restaurant_id',requestUrl.searchParams.get('restaurant_id'));
      let id = parseInt(requestUrl.searchParams.get('restaurant_id'),10);
      return handleReviews(event,requestUrl,id);
    }

    if( event.request.url.indexOf("restaurant")){
        let id = parseInt(requestUrl.searchParams.get('restaurant_id'),10);
        if(!id){
          id = -1;
        }
        console.log('handling restaurants', id);
        return handleRestaurant(event,requestUrl, id);
    }


  } else { //otherwise, use cache

    return handleCache(event, requestUrl);

  }

});

function handleRestaurant(event,requestUrl,id){
  event.respondWith(
    dbPromise.then(function(db) {

      var tx = db.transaction('restaurants', 'readonly');
      var store = tx.objectStore('restaurants');
      return store.get(parseInt(id,10));

    }).then(function(items) {

      return (items && items.length) || fetch(event.request)

          .then(function (response){
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
    }).then(function(ultimateResponse){
      return new Response(JSON.stringify(ultimateResponse));
    })
  );
}

function handleReviews(event,requestUrl,id){
  event.respondWith(
    dbPromise.then(function(db) {

      var tx = db.transaction('reviews', 'readonly');
      var store = tx.objectStore('reviews');
      var idx = store.index("restaurant_id");
      return idx.getAll(id);

    }).then(function(items) {

      return (items.length && items) || fetch(event.request)

          .then(function (response){
            console.log('returning review response', response);
            return response.json();
          })
          .then(function (json) {

            return dbPromise.then(function (db) {
              const tx = db.transaction("reviews", "readwrite");
              const store = tx.objectStore("reviews");
              json.forEach(review => {
                store.put({id: review.id, "restaurant_id": review.restaurant_id, data: review});
              });
              return json;
          });
        });
    }).then(function(ultimateResponse){
      //https://github.com/thefinitemonkey/udacity-restaurant-reviews/blob/master/app/sw.js
      if (ultimateResponse[0].data) {
        // Need to transform the data to the proper format
        const mapResponse = ultimateResponse.map(review => review.data);
        return new Response(JSON.stringify(mapResponse));
      }
      return new Response(JSON.stringify(ultimateResponse));
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

