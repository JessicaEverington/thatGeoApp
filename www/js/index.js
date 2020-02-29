var map; // Google map var
var db; // declare our db var
const dbSize = 5 * 1024 * 1024; // default sizing for LocalStorage db
//Anup's authorization
var baseUrl = "http://vanapi.gitsql.net"; // base URL for our Authorization Tokens re API login

// Initialize the Google Map
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 64.128288, lng: -21.827774}, 
    // iceland = 64.128288, -21.827774.
    zoom: 12
  });
}

var app = {
    // Application Constructor
    initialize: function() {
      this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
      document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
      app.receivedEvent('deviceready');
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {

    // WEBSQL DATABASE
      // Establish the LocalStorage Db
      db = openDatabase("places", "1", "MyPlaces", dbSize);
      // transactions are doers. In this case, the SQL statement
      db.transaction(
        function(tx){
          tx.executeSql(
            // Exact same kind of SQL statement as if we were doing it in mySQL
            // if no table exists, create a "places" table
            "CREATE TABLE IF NOT EXISTS " + 
            "PLACES(ID INTEGER PRIMARY KEY ASC, placeName, long, lat)"
          );
        }
      );

    // WEBSQL ADDING PLACES
    // Using async/await to insert places
    async function insertPlace(name, long='',lat=''){
      return new Promise(function(resolve, reject){
        // Add Places data to be saved in Web SQL
        db.transaction(function(tx){
          tx.executeSql(`INSERT INTO places (placeName, long, lat) VALUES (?,?,?)`, [name, long, lat], (tx, results)=>{
              console.log('insert results');
              console.log(results);
              console.log(lat);
              // AJAX CALL TO THE DB TO SIMULTANEOUSLY "POST" the data to the db
              $.ajax({
                type: "POST",
                url: `${baseUrl}/places`,
                // need to use the values going into webSQL
                data: JSON.stringify({
                  placeName: name,
                  longitude: long,
                  latitude: lat
                }),
                // data: JSON.stringify(results),
                // data: JSON.stringify({
                //   placeName: results[0].placeName,
                //   longitude: results[0].long,
                //   latitude: results[0].lat,
                // }),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                
                // get the token from local storage and add to header for authorization
                beforeSend: function(xhr){
                  xhr.setRequestHeader('authtoken', localStorage.getItem('token'))
                },
                // User token from API is saved to LocalStorage
                success: function(response) {
                  console.log('This is the API response from creating a place');
                  console.log(response);
                },
                error: function(e) {
                  alert('Uh oh, you have a db insertion error: ' + e.message);
                }
              });
              //OUTSIDE THE AJAX CALL we resolve
              resolve(results);
          });  
        });
      });    
    }

    // WEBSQL DISPLAY SAVED LIST OF PLACES
    async function displayPlaces(tx, results){
      return new Promise((resolve, reject) => {
          // We want everything to go into the #listView
          var list = $("#listView");
          // create an empty array where we can put our db stuff
          list.empty();
          console.log(results.rows);
          // Counting the total number of entries in the Db
          var len = results.rows.length, i;
          // looping over the total length of the array in the db
          // Rememeber LocalStorage is all arrays!! (no objects)
          for (i = 0; i < len; i++) {
            // For each row in the arr we want to append it to #listView and show the data like this
              list.append(
              `<li>
                <a class="navigateTo" 
                data-id="${results.rows.item(i).ID}" 
                long="${results.rows.item(i).long}" 
                lat="${results.rows.item(i).lat} ">
                ${results.rows.item(i).placeName}
                </a>
              </li>`);
          }

          // BINDING FUNCTIONS
          // this needs to be inside displayPlaces() to have tx access
          $("#listView").listview("refresh");
          $(".navigateTo").bind("tap", function(event, ui){ launchDirections(event); });
          resolve();
      });
    }
      // BINDING FUNCTIONS
      // want to bind these IDs so when a user taps then this Fn runs
      $("#savePlace").bind("tap",  function(event, ui) { saveMyPlace(); });
      $("#loginButton").bind("tap", function(event, ui){ performLogin(); });
      $("#launchCamera").bind("tap", function(event, ui){ takePic(); });
      

      // LAUNCH NATIVE NAV DIRECTIONS
      //calls directions and passes in lat/long + launch native navigation
      function launchDirections(event){
        directions.navigateTo(
          event.target.getAttribute('lat'),
          event.target.getAttribute('long')
        ); 
      }

      // CAMERA METHOD
      // accesses the camera on the phone and takes a photo
      // no permanence, you lose the photo when you close the app
      function takePic(){
        navigator.camera.getPicture(onSuccess, onFail, 
          { 
            quality: 50,
            destinationType: Camera.DestinationType.FILE_URI,
            cameraDirection: Camera.Direction.FRONT
          });
        // success method display img src in #selfie
        function onSuccess(imageURI) {
          var image = document.getElementById('selfie');
          image.src = imageURI;
        }
        // fail method displays a message to user 
        function onFail(message) {
          alert('Failed because: ' + message);
        }
        
      }

      // SAVE PLACES
      function saveMyPlace(){
        // get the value of my current place
        let currentPlaceName = $("#placeName").val();
        
        // use the phone's geolocation to get the coords 
        navigator.geolocation.getCurrentPosition(saveRecord, onError);

        function saveRecord(position){
          // insert into webSQL to save the record
          insertPlace(currentPlaceName, position.coords.longitude,  position.coords.latitude);
          console.log(currentPlaceName);
          // go to the home page after you're done 
          $("body").pagecontainer("change", "#home");
        }
        
        async function onError(error) {
          alert('code: '    + error.code    + '\n' +
              'message: ' + error.message + '\n');
          // make sure to wait for the insertPlace to run first
          await insertPlace(currentPlaceName, 'N/A', 'N/A');
          // now take me home
          $("body").pagecontainer("change", "#home");
        }
      }

      // USER LOGIN 
      function performLogin(){
        // what we're using to login
        data = {
          "username": $("#username").val(),
          "password": $("#password").val()
        }

        // Post the form data to Anup's API oAuth
        // We need to POST it before we can GET it
        $.ajax({
          type: "POST",
          url: `${baseUrl}/auth`,
          data: JSON.stringify(data),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          // User token from API is saved to LocalStorage
          success: function(response) {
            console.log('This is the API response' + response);
            // "setItem" saves it to LocalStorage
            localStorage.setItem('token', response.token);
            // Now we run the sync to GET our authroization
            initialSync();
            // Once authorized, redirect to home page
            $("body").pagecontainer("change", "#home");
          },
          error: function(e) {
            alert('Uh oh, you have a login error: ' + e.message);
          }
        });
    }

    function initialSync(){
      $.ajax({
        type: "GET",
        url: `${baseUrl}/places`,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        // get the token from local storage and add to header
        beforeSend: function(xhr){
          xhr.setRequestHeader('authtoken', localStorage.getItem('token'))
        },
        success: function(response) {
          //When we initialize we must also boot up from the Node DB
          console.log(response);
          for ( var i = 0; i < response.length; i++) {
            insertPlace(response[i].placeName, response[i].longitude, response[i].latitude)
            // this is looping over all the places stored in the Node db for rendering
          };
        },
        error: function(e) {
          // error handling to let user know if something happened and what it was
            alert('Uh oh, your authorization sync has the following error: ' + e.message);
          }
      }); 
    }

    // GEOLOCATION
    // Cordova feature - taps into phone's geo and allows us to use it 
    function onGeoSuccess(position) {
        let coords = { 
          'lat': position.coords.latitude, 
          'long': position.coords.longitude 
        };

        // placing our obj into LocalStorage as a string
        localStorage.setItem('currentPosition', JSON.stringify(coords));
        console.log(coords);
        
        // creating the var string for place
        var myLatLng = {
          lat: coords.lat, 
          lng: coords.long
        };

        // open up the Google map
        var map = new google.maps.Map(document.getElementById('map'), {
          zoom: 20,
          center: myLatLng
        });

        // Google mapalicious dishing my saved place to find my way there
        new google.maps.Marker({
          position: myLatLng,
          map: map,
          title: 'My Location'
        });
      }

      // ERROR HANDLING FOR GEOLOCATION
      function onGeoError(error) {
          alert('code: ' + error.code + '\n' + 'message: ' + error.message + '\n');
      }
    
      $(document).on( 'pagebeforeshow' , '#addplace' , function(event){
        // before the page load I want to 
      });

      // goes into localstorage to get places from webSQL table
      $(document).on( 'pagebeforeshow' , '#home' , function(event){
        db.transaction(function(tx){
          tx.executeSql(`SELECT * FROM places`, [], (tx, res)=>{
              displayPlaces(tx, res)
          });  
        });
      });
    }
// add additional functions here
};
