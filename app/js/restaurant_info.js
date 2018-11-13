/*jshint esversion: 6 */

var dbPromise = idb.open('db-udacity-mws-rr', 1, function(upgradeDb) {

    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
      let rr = upgradeDb.createObjectStore('restaurants', {keyPath: 'id'});
      let rv = upgradeDb.createObjectStore('reviews', {keyPath: 'id'})
                .createIndex('restaurant_id', 'restaurant_id');
    }

  });


let restaurant;
var map;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();

  window.addEventListener('offline', function(e) { console.log('offline'); });

  window.addEventListener('online', function(e) {
    console.log('online');
    //look for idb reviews with pending == true
     dbPromise.then(function(db) {

      var tx = db.transaction('reviews', 'readonly');
      var store = tx.objectStore('reviews');

      return store.getAll();

    }).then(function(reviews){
        const url = `${DBHelper.REVIEWS_URL}/`;

        reviews.forEach(review => {
          if(review.data.pending == true){
            delete review.data.pending;
            return fetch(url, {method: 'POST', body: JSON.stringify(review.data)}).then(response => {

            if (!response.ok) return Promise.reject("Couldn't make your pending review live.");
              return response.json();
            })
          }

        });
    }).then(function(ultimateResponse){
           dbPromise.then(function(db) {

            var tx = db.transaction('reviews', 'readonly');
            var store = tx.objectStore('reviews');

            return store.getAll();
          });
    }).then(function(reviews){
      fillReviewsHTML(reviews);
    });
  });
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      if(restaurant.data){
        restaurant = restaurant.data;
      }

      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
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
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL';
    callback(error, null);
  } else {
      DBHelper.fetchRestaurantById(id, (error, restaurant) => {
        console.log('frfh',id, error, restaurant);
        self.restaurant = restaurant;
        if (!restaurant) {
          console.error(error);
          return;
        }

        console.log('ri-fetchRestaurantFromURL', self.restaurant);
        fillRestaurantHTML(restaurant);
        callback(null, restaurant);
        })
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant) => {
  console.log('res HTML',restaurant);
  if(restaurant.data){
    restaurant = restaurant.data;
  }
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const pic = document.getElementById('restaurant-img');
  const url320 = DBHelper.imageUrlForRestaurant(restaurant);

  const src320 = document.createElement('source');
  src320.setAttribute('srcset', url320);
  src320.setAttribute('media', '(max-width: 320px)');

  const src475 = document.createElement('source');
  src475.setAttribute('srcset', DBHelper.imageUrlForRestaurant475(restaurant));

  const image = document.createElement('img');
  image.setAttribute('src', url320);
  image.className = 'restaurant-img';
  image.setAttribute('title',`Photo representing ${restaurant.name} restaurant.`);

  pic.appendChild(src320);
  pic.appendChild(src475);
  pic.appendChild(image);

  wireSubmitButton(restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML(restaurant.operating_hours);
  }
  // fill reviews
  console.log('about to fill reviews',self.restaurant);

  DBHelper.fetchReviewsById(restaurant.id)
    .then(fillReviewsHTML);
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.setAttribute('class','day');
    day.innerHTML = `<span class="small-day"><abbr title='${key}'>${key.substring(0,3).toUpperCase()}</abbr></span><span class="big-day">${key}</span>`;
    row.appendChild(day);

    const time = document.createElement('td');
    time.setAttribute('class','time');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

function handleClick_ReviewToggle() {
  let el;

  el = document.getElementById('add-review');
  el.classList.toggle('hide');

  el = document.getElementById('add-review-heading');
  el.classList.toggle('hide');

  el = document.getElementById('lnkViewReviews');
  el.classList.toggle('hide');

  el = document.getElementById('view-review-heading');
  el.classList.toggle('hide');

  el = document.getElementById('lnkAddReview');
  el.classList.toggle('hide');

  el = document.getElementById('reviews-list');
  el.classList.toggle('hide');
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.reviews) => {
  console.log('now attempting reviews', reviews);
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  title.setAttribute('class','res-reviews');
  title.id = "view-review-heading";
  container.appendChild(title);

  const link = document.createElement('a');
  link.innerHTML = "Add Review";
  link.id = 'lnkAddReview';
  link.setAttribute('class','link-review-toggle link');
  link.onclick = handleClick_ReviewToggle;
  container.appendChild(link);

  let linkToggle = document.getElementById('lnkViewReviews');
  linkToggle.onclick = handleClick_ReviewToggle;

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  for (let review of reviews) {
    console.log('review-html', review);
    if(review.data){
      ul.appendChild(createReviewHTML(review.data));
    } else {
      ul.appendChild(createReviewHTML(review));
    }

  };
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');

  li.appendChild(createReviewHeader320(review));
  li.appendChild(createReviewHeader475(review));

  const comments = document.createElement('p');
  comments.innerHTML = handleNonsense(review.comments);
  comments.setAttribute('class','rev-comments');
  li.appendChild(comments);

  return li;
}

//https://digwp.com/2011/07/clean-up-weird-characters-in-database/
handleNonsense = (value) => {
  console.log('attempting to handle nonsense', value);
  let result = value;

  result = result.split('â€œ').join('“');
  result = result.split('â€').join('”');
  result = result.split('â€™').join('’');
  result = result.split('â€˜').join('‘');
  result = result.split('â€”').join('–');
  result = result.split('â€“').join('—');
  result = result.split('â€¢').join('-');
  result = result.split('â€¦').join('…');

  return result;
}

createReviewHeader320 = (review) => {
  let revDate = reviewDate(review);



  const div = document.createElement('div');
  div.setAttribute('class','rev-header-320');

  const name = document.createElement('p');
  name.innerHTML = `${review.name} (${revDate})`;
  name.setAttribute('class', 'rev-name');
  div.appendChild(name);

  const rule = document.createElement('div');
  rule.setAttribute('class','rev-rule');
  div.appendChild(rule);

  const rating = document.createElement('p');
  rating.appendChild(createRating(review.rating));
  rating.setAttribute('class', 'rev-rating');
  div.appendChild(rating);

  return div;
}

createReviewHeader475 = (review) => {
  let revDate = reviewDate(review);

  const div = document.createElement('div');
  div.setAttribute('class','rev-header-475');

  const name = document.createElement('div');
  name.innerHTML = `${review.name} (${revDate})`;
  name.setAttribute('class', 'rev-name');
  div.appendChild(name);

  const rating = document.createElement('div');
  rating.setAttribute('class', 'rev-rating');
  rating.appendChild(createRating(review.rating));

  div.appendChild(rating);

  return div;
}

function reviewDate(review){
  let reviewDate = new Date(review.updatedAt);

  reviewDate = reviewDate.toLocaleDateString();

  if(reviewDate == 'Invalid Date'){
    reviewDate = 'Pending';
  }

   return reviewDate;
}

createRating = (ratingCount) => {
  const rating = document.createElement('span');

  for(let i = 0; i < ratingCount; i++){
    const star = document.createElement('img');
    star.src = '/img/star.svg';
    rating.appendChild(star);
  }

  rating.setAttribute('title', `Rating: ${ratingCount}`);

  return rating;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}


function wireSubmitButton(restaurant){
  let button = document.getElementById('submit-review');

  button.dataset.id = restaurant.id;
  button.onclick = handleSubmit;

  const el = document.getElementById('form-add-review');
  el.addEventListener('submit', event => {
  event.preventDefault();

});
}

  function handleSubmit() {
    const url = `${DBHelper.REVIEWS_URL}/`;

    console.log('review being posted here:',url);

    let name = document.getElementById('txtName').value;
    let comments = document.getElementById('taComments').value;
    let rating = document.querySelector('input[name="rating"]:checked').value;

    let data = {
      "restaurant_id": parseInt(this.dataset.id,10),
      "name": name,
      "rating": parseInt(rating,10),
      "comments": comments
    }

    console.log('about to fetch:', data);
    if(!window.navigator.onLine){
        putReview(data);
        location.reload(true);
    } else {

      return fetch(url, {method: 'POST', body: JSON.stringify(data)}).then(response => {

        if (!response.ok) return Promise.reject("Couldn't mark this restaurant as your favorite.");
        return response.json();

      }).then(newReview => {
        console.log('new review', newReview);
        putReview(newReview);
        location.reload(true);
      });
    }

  function putReview(review){
    let tempId;

    if(!review.id){
      tempId = -review.restaurant_id;
    }

    review.pending = !window.navigator.onLine; //if we're online, pending is false
    dbPromise.then(function (db) {
        const tx = db.transaction("reviews", "readwrite");
        const store = tx.objectStore("reviews");
        let reviewData = {id: tempId, "restaurant_id": review.restaurant_id, data: review};
        console.log('review data', reviewData);
        store.put(reviewData);
        return reviewData;
      });
  }
}