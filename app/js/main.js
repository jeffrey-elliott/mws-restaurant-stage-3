/*jshint esversion: 6 */

var dbPromise = idb.open('db-udacity-mws-rr', 1, function(upgradeDb) {

    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
      let rr = upgradeDb.createObjectStore('restaurants', {keyPath: 'id'});
      let rv = upgradeDb.createObjectStore('reviews', {keyPath: 'id'})
                .createIndex('restaurant_id', 'restaurant_id');
    }

  });

let restaurants,
  neighborhoods,
  cuisines;
var newMap;
var markers = [];

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Initialize leaflet map, called from HTML.
 */
initMap = () => {
  self.newMap = L.map('map', {
        center: [40.722216, -73.987501],
        zoom: 12,
        scrollWheelZoom: false
      });
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
    mapboxToken: 'pk.eyJ1IjoiNXFvZW9tYW4yejBldDEya2xjbXoiLCJhIjoiY2pvZjAzc211MDQ3dzNwbno2ZDZmdnJqNCJ9.jIwBY86rwhQzLf3LDewluQ',
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  }).addTo(newMap);

  updateRestaurants();
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  });
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.setAttribute('title',`Photo representing ${restaurant.name} restaurant.`);
  li.append(image);

  const name = document.createElement('h1');
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  const favButton = favoriteButton(restaurant);
  li.append(favButton);

  return li;
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.newMap);
    marker.on("click", onClick);
    function onClick() {
      window.location.href = marker.options.url;
    }
    self.markers.push(marker);
  });

}

//inspired by: https://alexandroperez.github.io/mws-walkthrough/?3.3.favorite-restaurants-using-accessible-toggle-buttons
function handleClick() {
  const isFavorite = this.getAttribute('aria-pressed') == 'true';
  const url = `${DBHelper.DATABASE_URL}/${this.dataset.id}/?is_favorite=${!isFavorite}`;

  return fetch(url, {method: 'PUT'}).then(response => {
    if (!response.ok) return Promise.reject("Couldn't mark this restaurant as your favorite.");
    return response.json();
  }).then(updatedRestaurant => {

   updateRestaurant(updatedRestaurant);

    this.setAttribute('aria-pressed', !isFavorite);

  });
}

function favoriteButton(restaurant) {

  const el = document.createElement('button');

  el.className = "favorite-button";
  el.dataset.id = restaurant.id;
  el.setAttribute('aria-label', `Make ${restaurant.name} one of your favorites`);
  el.setAttribute('aria-pressed', restaurant.is_favorite);
  el.onclick = handleClick;

  return el;
}

function updateRestaurant(restaurant){
  dbPromise.then(function (db) {
        const tx = db.transaction("restaurants", "readwrite");
        const store = tx.objectStore("restaurants");
        store.put({id: restaurant.id, data: restaurant});
        return restaurant;
    });
}