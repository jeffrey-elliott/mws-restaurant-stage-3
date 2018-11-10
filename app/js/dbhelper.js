/*jshint esversion: 6 */

import idb from 'idb';

let fetchedCuisines;
let fetchedNeighborhoods;

var dbPromise = idb.open('db-udacity-mws-rr', 1, function(upgradeDb) {

    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
      let rr = upgradeDb.createObjectStore('restaurants', {keyPath: 'id'});
      let rv = upgradeDb.createObjectStore('reviews', {keyPath: 'id'})
                .createIndex('restaurant_id', 'restaurant_id');
    }

  });

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;

    //const port = 8234; // Change this to your server port
    //return `http://localhost:${port}/data/restaurants.json`;
  }

  static get REVIEWS_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/reviews`;

    //const port = 8234; // Change this to your server port
    //return `http://localhost:${port}/data/restaurants.json`;
  }


  static updateRestaurant(json){
    return dbPromise.then(function (db) {
          const tx = db.transaction("restaurants", "readwrite");
          const store = tx.objectStore("restaurants");
          store.put({id: id, data: json});
          return json;
      });
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback, id) {

    let fetchUrl = DBHelper.DATABASE_URL;

    if(typeof id != "undefined") fetchUrl += '/' + id;

    return DBHelper.fetchByUrl(fetchUrl, callback);
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {

    let fetchUrl = DBHelper.DATABASE_URL + '/' + id;

    return DBHelper.fetchByUrl(fetchUrl, callback);
  }


  static fetchReviewsById(id) {

    let url = `${DBHelper.REVIEWS_URL}/?restaurant_id=${id}`;

    return fetch(url).then(response => {
      if (!response.ok) return Promise.reject("Reviews couldn't be fetched from network");
      return response.json();
    })
    .catch(error => {
      // if reviews couldn't be fetched from network:
      // TODO: try to get reviews from idb
      console.log(error);
      return null; // return null to handle error, as though there are no reviews.
    });
  }



  static fetchByUrl(fetchUrl, callback) {
    fetch(fetchUrl).then(function(response) {
      console.log('response ', response);
      if(response.ok) {
        return response.json();
      }
      throw new Error('Network response was not ok.');
    }).then(function(json) {
      callback(null, json);
    }).catch(function(error) {
      const message = (`Request failed. Returned status of ${error.message}`);
      callback(message, null);
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return DBHelper.handleMissingImage(restaurant);
  }

  static imageUrlForRestaurant475(restaurant) {
    return DBHelper.handleMissingImage(restaurant,475);
  }

  static handleMissingImage(restaurant, size){
    if(!restaurant.photograph){
      return DBHelper.missingImage(size);
    }

    if(size){
      return (`/img/${size}/${restaurant.photograph}.jpg`);
    }

    return (`/img/${restaurant.photograph}.jpg`);
  }

  static missingImage(size){
    return '/img/restaurant.svg';
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }



}
