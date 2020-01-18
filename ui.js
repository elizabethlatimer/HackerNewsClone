$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navWelcome = $("#nav-welcome");
  const $navSubmit = $("#nav-submit");
  const $navMyArticles = $("#nav-own");
  const $navFavorites = $("#nav-favorites");
  const $favoritedArticles = $("#favorited-articles");
  const $myArticles = $("#my-articles");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function () {
    hideElements();
    generateFavorites();
    await generateStories();
    $allStoriesList.show();
  });

  $("body").on("click", "#nav-submit", function () {
    hideElements();
    $("#submit-form").show();
  })

  $("body").on("click", "#nav-favorites", async function () {
    hideElements();
    generateFavorites();
    $("#favorited-articles").show();
  });

  $("body").on("click", "#nav-own", async function () {
    hideElements();
    generateFavorites();
    generateOwnStories();
    $("#my-articles").show();
  });

  $("body").on("submit", "#submit-form", async function (event) {
    event.preventDefault();
    let userToken = localStorage.getItem("token", currentUser.loginToken);
    let newStory = {
      author: $("#author").val(),
      title: $("#title").val(),
      url: $("#url").val()
    }

    let newlyAddedStory = (await StoryList.addStory(userToken, newStory)).data.story;
    const result = generateStoryHTML(newlyAddedStory);
    $allStoriesList.prepend(result);
    currentUser.ownStories.push(newlyAddedStory);
    hideElements();
    $allStoriesList.show();
  })

  $("body").on("click", ".fa-star", async function (e) {
    let userToken = localStorage.getItem("token", currentUser.loginToken);
    let username = localStorage.getItem("username", currentUser.username);
    let storyId = $(e.target).parent().attr("id");
    let thisStar = $(e.target);
    if (thisStar.hasClass("far")) {
      let response = await currentUser.addFavorite(userToken, username, storyId);
      currentUser.favorites = response.error ? currentUser.favorites : response.favorites;
      thisStar.toggleClass("far fas");
    }
    else {
      let response = await currentUser.removeFavorite(userToken, username, storyId);
      currentUser.favorites = response.error ? currentUser.favorites : response.favorites;
      thisStar.toggleClass("far fas");
    }
  })

  function findIndexToRemove(relevantCurrentUserList, targetId) {
    let indexToRemove = relevantCurrentUserList.findIndex(function (thisStory) {
      return (thisStory.storyId === targetId);
    });
    return indexToRemove
  }

  $("body").on("click", '.trash-can', async function(e){
    e.preventDefault();
    let userToken = localStorage.getItem("token", currentUser.loginToken);
    let storyId = $(e.target).attr("data-storyId");
    await StoryList.deleteStory(userToken, storyId);
    currentUser.ownStories.splice(findIndexToRemove(currentUser.ownStories, storyId), 1);
    currentUser.favorites.splice(findIndexToRemove(currentUser.favorites, storyId), 1);
    generateOwnStories();
    generateFavorites();
    generateStories();
    
    // matchingStories.forEach( story => story.delete)
  });
  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);

    if (currentUser) {
      showNavForLoggedInUser();
      generateFavorites();
    }

    await generateStories();
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");


    // update the navigation bar
    showNavForLoggedInUser();

    //update favorites list
    generateFavorites();
    generateStories();

    // show the stories
    $allStoriesList.show();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  async function generateFavorites() {
    // access favorites array of current User instance
    const favorites = currentUser.favorites;
    // loop through all of our favorites and generate HTML for them
    $favoritedArticles.empty();
    for (let favorite of favorites) {
      const result = generateStoryHTML(favorite);
      $favoritedArticles.append(result);
    }
  }

  async function generateOwnStories() {
    const ownStories = currentUser.ownStories;
    $myArticles.empty();
    for (let own of ownStories) {
      const result = generateStoryHTML(own);
      $myArticles.append(result);
    }

  }

  /**
   * A function to render HTML for an individual Story instance
   */
  
  function generateStoryHTML(story) {
    const hostName = getHostName(story.url);
    let matchingStoryInFavorites;
    if (currentUser) {
      matchingStoryInFavorites = (currentUser.favorites.find(function (thisFavorite) {
        return (story.storyId === thisFavorite.storyId);
      }));
    }
    const calledByFavorites = (generateStoryHTML.caller === generateFavorites);
    let starClass = (calledByFavorites || matchingStoryInFavorites) ? "fas" : "far";

    let deleteButton = currentUser && currentUser.username === story.username ? `<i class="trash-can fa-trash fas" data-storyId="${story.storyId}"></i>` : '';

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
      <i class="fa-star ${starClass}"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a> ${deleteButton}
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
        
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $myArticles,
      $loginForm,
      $createAccountForm,
      $favoritedArticles
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navWelcome.show();
    $("#nav-user-profile").text(currentUser.name);
    $navSubmit.show();
    $navFavorites.show();
    $navMyArticles.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
