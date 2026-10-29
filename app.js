(function () {
  "use strict";

  var STORAGE_KEY = "nuka-demo-state-v1";

  var experiences = [
    { id: "mythunters", title: "Mythunters: Asymmetrical", creator: "Nuka Labs", players: 1842, visits: "1.4M", category: "Horror", art: "linear-gradient(135deg,#6d1721,#18131d 58%,#0c0d10)", popular: true },
    { id: "cityshift", title: "Cityshift", creator: "Nuka Labs", players: 703, visits: "482K", category: "Action", art: "linear-gradient(135deg,#11445b,#1b2735 52%,#101216)", popular: true },
    { id: "blockyard", title: "Blockyard", creator: "rotor", players: 258, visits: "118K", category: "Sandbox", art: "linear-gradient(135deg,#886e36,#343022 55%,#141516)", popular: false },
    { id: "nightdrive", title: "Night Drive 06", creator: "parallax", players: 991, visits: "730K", category: "Social", art: "linear-gradient(135deg,#533479,#19213a 52%,#0d1017)", popular: true },
    { id: "towerline", title: "Towerline", creator: "archival", players: 149, visits: "92K", category: "Obby", art: "linear-gradient(135deg,#296765,#1d3134 55%,#111418)", popular: false },
    { id: "afterlight", title: "Afterlight", creator: "silentroom", players: 421, visits: "201K", category: "Adventure", art: "linear-gradient(135deg,#7b4d35,#342324 55%,#111216)", popular: false },
    { id: "redline", title: "Redline Circuit", creator: "oversteer", players: 634, visits: "505K", category: "Racing", art: "linear-gradient(135deg,#7e1f1f,#312020 52%,#111216)", popular: true },
    { id: "static", title: "STATIC", creator: "voidsignal", players: 82, visits: "34K", category: "Experimental", art: "linear-gradient(135deg,#3b3d42,#202329 55%,#0e1013)", popular: false }
  ];

  var people = [
    { id: "miles", name: "Miles", handle: "miles", status: "In Night Drive 06", online: true, initials: "M", avatar: "linear-gradient(145deg,#f1c589,#8d5f3f)" },
    { id: "juno", name: "Juno", handle: "jun0", status: "Online", online: true, initials: "J", avatar: "linear-gradient(145deg,#d4a2ff,#6c4e8d)" },
    { id: "kevin", name: "Kevin", handle: "kevbox", status: "Offline", online: false, initials: "K", avatar: "linear-gradient(145deg,#9ed7ff,#4e6d89)" },
    { id: "luca", name: "Luca", handle: "lucamakes", status: "In Studio", online: true, initials: "L", avatar: "linear-gradient(145deg,#a9efba,#52755a)" },
    { id: "sora", name: "Sora", handle: "sorablue", status: "Offline", online: false, initials: "S", avatar: "linear-gradient(145deg,#acc2ff,#4b5a85)" },
    { id: "nova", name: "Nova", handle: "novaexe", status: "Online", online: true, initials: "N", avatar: "linear-gradient(145deg,#ffd0e6,#8c5e70)" }
  ];

  var defaultState = {
    profile: {
      displayName: "Eddie",
      username: "eddie",
      bio: "Building weird games, web experiments, and things that probably should not work."
    },
    favorites: ["mythunters", "nightdrive"],
    recent: ["mythunters", "cityshift", "nightdrive", "redline"],
    friends: ["miles", "juno", "kevin", "luca"],
    incomingRequests: ["sora"],
    outgoingRequests: [],
    dismissedSuggestions: [],
    notifications: [
      { id: "n1", type: "friend", title: "New friend request", body: "Sora sent you a friend request.", unread: true },
      { id: "n2", type: "game", title: "Mythunters updated", body: "Nuka Labs published a new build.", unread: true },
      { id: "n3", type: "social", title: "Miles is online", body: "Miles started playing Night Drive 06.", unread: false }
    ]
  };

  var state = loadState();
  var currentRoute = "home";
  var currentFriendsTab = "all";
  var currentDiscoverFilter = "all";
  var searchQuery = "";

  var el = {};
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    renderAll();
    routeFromHash();
    setGreeting();
  }

  function cacheElements() {
    [
      "globalSearch","notificationButton","notificationBadge","notificationDrawer","closeNotifications","notificationList","markAllRead",
      "scrim","sidebar","menuButton","topUsername","topAvatar","profileChip","requestCount","continueGrid","friendsStrip","recommendedGrid",
      "discoverGrid","discoverEmpty","discoverFilter","friendsTabs","friendList","friendsCount","requestsTabCount","addFriendButton",
      "profileUsername","profileHandle","profileBio","profileAvatar","statFriends","statFavorites","statPlayed","profileFavorites",
      "editProfileButton","profileModal","profileForm","editDisplayName","editUsername","editBio","saveProfileButton",
      "addFriendModal","addFriendForm","friendUsername","sendFriendRequestButton","toastStack","welcomeTitle"
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function bindEvents() {
    document.querySelectorAll("[data-route]").forEach(function (button) {
      button.addEventListener("click", function () {
        navigate(button.dataset.route);
        if (button.dataset.subroute === "requests") {
          currentFriendsTab = "requests";
          renderFriends();
        }
      });
    });

    document.querySelectorAll(".nav-item").forEach(function (button) {
      button.addEventListener("click", closeMobilePanels);
    });

    el.profileChip.addEventListener("click", function () { navigate("profile"); });
    el.notificationButton.addEventListener("click", openNotifications);
    el.closeNotifications.addEventListener("click", closeNotifications);
    el.scrim.addEventListener("click", closeMobilePanels);
    el.menuButton.addEventListener("click", toggleMenu);

    el.markAllRead.addEventListener("click", function () {
      state.notifications.forEach(function (n) { n.unread = false; });
      saveState();
      renderNotifications();
      toast("All notifications marked as read.");
    });

    el.globalSearch.addEventListener("input", function (event) {
      searchQuery = event.target.value.trim().toLowerCase();
      if (searchQuery && currentRoute !== "discover") navigate("discover");
      renderDiscover();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "/" && document.activeElement !== el.globalSearch && !isTypingField(document.activeElement)) {
        event.preventDefault();
        el.globalSearch.focus();
      }
      if (event.key === "Escape") closeMobilePanels();
    });

    el.discoverFilter.addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      currentDiscoverFilter = button.dataset.filter;
      Array.from(el.discoverFilter.children).forEach(function (child) { child.classList.toggle("active", child === button); });
      renderDiscover();
    });

    el.friendsTabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tab]");
      if (!button) return;
      currentFriendsTab = button.dataset.tab;
      Array.from(el.friendsTabs.children).forEach(function (child) { child.classList.toggle("active", child === button); });
      renderFriends();
    });

    el.editProfileButton.addEventListener("click", openProfileModal);
    el.addFriendButton.addEventListener("click", function () {
      el.friendUsername.value = "";
      el.addFriendModal.showModal();
    });

    el.profileForm.addEventListener("submit", handleProfileSubmit);
    el.addFriendForm.addEventListener("submit", handleFriendSubmit);
    window.addEventListener("hashchange", routeFromHash);
  }

  function isTypingField(node) {
    if (!node) return false;
    return ["INPUT","TEXTAREA"].indexOf(node.tagName) !== -1;
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return deepClone(defaultState);
      return mergeState(deepClone(defaultState), saved);
    } catch (error) {
      return deepClone(defaultState);
    }
  }

  function mergeState(base, saved) {
    Object.keys(saved || {}).forEach(function (key) {
      if (saved[key] && typeof saved[key] === "object" && !Array.isArray(saved[key]) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        Object.assign(base[key], saved[key]);
      } else {
        base[key] = saved[key];
      }
    });
    return base;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderCounters();
  }

  function navigate(route) {
    currentRoute = route;
    if (location.hash !== "#" + route) location.hash = route;
    applyRoute();
  }

  function routeFromHash() {
    var requested = location.hash.replace("#", "");
    var valid = ["home","discover","friends","profile"];
    currentRoute = valid.indexOf(requested) !== -1 ? requested : "home";
    applyRoute();
  }

  function applyRoute() {
    document.querySelectorAll(".route").forEach(function (section) {
      section.classList.toggle("active", section.id === "route-" + currentRoute);
    });
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.dataset.route === currentRoute);
    });
    if (currentRoute === "discover") renderDiscover();
    if (currentRoute === "friends") renderFriends();
    if (currentRoute === "profile") renderProfile();
    closeMobilePanels();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAll() {
    renderHome();
    renderDiscover();
    renderFriends();
    renderProfile();
    renderNotifications();
    renderCounters();
  }

  function setGreeting() {
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    el.welcomeTitle.textContent = greeting + ", " + state.profile.displayName + ".";
  }

  function renderHome() {
    renderGameGrid(el.continueGrid, state.recent.slice(0, 5).map(findExperience).filter(Boolean));
    renderGameGrid(el.recommendedGrid, experiences.filter(function (game) { return state.recent.indexOf(game.id) === -1; }).slice(0, 4));
    el.friendsStrip.innerHTML = "";
    state.friends.map(findPerson).filter(Boolean).forEach(function (person) {
      var button = document.createElement("button");
      button.className = "person-bubble";
      button.innerHTML =
        '<div class="person-avatar" style="--avatar:' + person.avatar + '">' +
          escapeHtml(person.initials) +
          '<span class="presence ' + (person.online ? "online" : "") + '"></span>' +
        '</div>' +
        '<strong>' + escapeHtml(person.name) + '</strong>' +
        '<span>' + escapeHtml(person.status) + '</span>';
      button.addEventListener("click", function () { toast("Profile pages for friends are next on the roadmap."); });
      el.friendsStrip.appendChild(button);
    });
  }

  function renderDiscover() {
    var list = experiences.slice();

    if (currentDiscoverFilter === "popular") {
      list = list.filter(function (game) { return game.popular; });
    } else if (currentDiscoverFilter === "favorites") {
      list = list.filter(function (game) { return state.favorites.indexOf(game.id) !== -1; });
    }

    if (searchQuery) {
      list = list.filter(function (game) {
        var haystack = [game.title, game.creator, game.category].join(" ").toLowerCase();
        return haystack.indexOf(searchQuery) !== -1;
      });
    }

    renderGameGrid(el.discoverGrid, list);
    el.discoverEmpty.classList.toggle("hidden", list.length > 0);
  }

  function renderGameGrid(container, list) {
    container.innerHTML = "";
    list.forEach(function (game) {
      var card = document.createElement("article");
      card.className = "game-card";
      var favorite = state.favorites.indexOf(game.id) !== -1;
      card.innerHTML =
        '<div class="game-art" style="--art:' + game.art + '">' +
          '<span class="game-art-label">' + escapeHtml(game.category.toUpperCase()) + '</span>' +
          '<button class="favorite-button ' + (favorite ? "active" : "") + '" aria-label="Toggle favorite">' + (favorite ? "★" : "☆") + '</button>' +
        '</div>' +
        '<div class="game-info">' +
          '<strong>' + escapeHtml(game.title) + '</strong>' +
          '<div class="game-meta"><span class="online-dot">●</span><span>' + formatNumber(game.players) + ' playing</span><span>·</span><span>' + escapeHtml(game.creator) + '</span></div>' +
        '</div>';

      card.querySelector(".favorite-button").addEventListener("click", function (event) {
        event.stopPropagation();
        toggleFavorite(game.id);
      });
      card.addEventListener("click", function () { launchExperience(game); });
      container.appendChild(card);
    });
  }

  function toggleFavorite(id) {
    var index = state.favorites.indexOf(id);
    if (index === -1) {
      state.favorites.unshift(id);
      toast("Added to favorites.");
    } else {
      state.favorites.splice(index, 1);
      toast("Removed from favorites.");
    }
    saveState();
    renderHome();
    renderDiscover();
    renderProfile();
  }

  function launchExperience(game) {
    state.recent = [game.id].concat(state.recent.filter(function (id) { return id !== game.id; })).slice(0, 12);
    saveState();
    renderHome();
    toast("Opening " + game.title + " — launcher integration comes next.");
  }

  function renderFriends() {
    var rows = [];

    if (currentFriendsTab === "all") {
      rows = state.friends.map(function (id) { return { person: findPerson(id), kind: "friend" }; });
    } else if (currentFriendsTab === "requests") {
      rows = state.incomingRequests.map(function (id) { return { person: findPerson(id), kind: "request" }; });
      state.outgoingRequests.forEach(function (handle) {
        rows.push({ person: { id: handle, name: handle, handle: handle, status: "Request sent", initials: handle.charAt(0).toUpperCase(), avatar: "linear-gradient(145deg,#d6d8dd,#737a86)" }, kind: "outgoing" });
      });
    } else {
      rows = people.filter(function (person) {
        return state.friends.indexOf(person.id) === -1 &&
          state.incomingRequests.indexOf(person.id) === -1 &&
          state.dismissedSuggestions.indexOf(person.id) === -1;
      }).map(function (person) { return { person: person, kind: "suggested" }; });
    }

    el.friendList.innerHTML = "";
    if (!rows.length) {
      el.friendList.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><h3>Nothing here yet</h3><p>This list is currently empty.</p></div>';
      return;
    }

    rows.filter(function (row) { return row.person; }).forEach(function (row) {
      var person = row.person;
      var item = document.createElement("div");
      item.className = "friend-row";
      var actions = "";

      if (row.kind === "friend") {
        actions = '<button class="small-button" data-action="message">Message</button><button class="small-button danger" data-action="remove">Remove</button>';
      } else if (row.kind === "request") {
        actions = '<button class="small-button primary" data-action="accept">Accept</button><button class="small-button" data-action="decline">Decline</button>';
      } else if (row.kind === "outgoing") {
        actions = '<button class="small-button" data-action="cancel">Cancel request</button>';
      } else {
        actions = '<button class="small-button primary" data-action="add">Add friend</button><button class="small-button" data-action="dismiss">Dismiss</button>';
      }

      item.innerHTML =
        '<div class="friend-avatar" style="--avatar:' + person.avatar + '">' + escapeHtml(person.initials) + '</div>' +
        '<div class="friend-copy"><strong>' + escapeHtml(person.name) + '</strong><p>@' + escapeHtml(person.handle) + ' · ' + escapeHtml(person.status) + '</p></div>' +
        '<div class="friend-actions">' + actions + '</div>';

      item.querySelectorAll("[data-action]").forEach(function (button) {
        button.addEventListener("click", function () { handleFriendAction(button.dataset.action, person, row.kind); });
      });
      el.friendList.appendChild(item);
    });
  }

  function handleFriendAction(action, person) {
    if (action === "message") {
      toast("DM UI is queued for the next pass.");
      return;
    }

    if (action === "remove") {
      state.friends = state.friends.filter(function (id) { return id !== person.id; });
      toast("Removed " + person.name + " from friends.");
    }

    if (action === "accept") {
      state.incomingRequests = state.incomingRequests.filter(function (id) { return id !== person.id; });
      if (state.friends.indexOf(person.id) === -1) state.friends.push(person.id);
      state.notifications.unshift({ id: "n-" + Date.now(), type: "friend", title: "Friend added", body: "You and " + person.name + " are now friends.", unread: true });
      toast("You are now friends with " + person.name + ".");
    }

    if (action === "decline") {
      state.incomingRequests = state.incomingRequests.filter(function (id) { return id !== person.id; });
      toast("Friend request declined.");
    }

    if (action === "cancel") {
      state.outgoingRequests = state.outgoingRequests.filter(function (id) { return id !== person.handle; });
      toast("Friend request cancelled.");
    }

    if (action === "add") {
      if (state.outgoingRequests.indexOf(person.handle) === -1) state.outgoingRequests.push(person.handle);
      state.dismissedSuggestions = state.dismissedSuggestions.filter(function (id) { return id !== person.id; });
      toast("Friend request sent to @" + person.handle + ".");
    }

    if (action === "dismiss") {
      if (state.dismissedSuggestions.indexOf(person.id) === -1) state.dismissedSuggestions.push(person.id);
      toast("Suggestion dismissed.");
    }

    saveState();
    renderAll();
  }

  function renderProfile() {
    var profile = state.profile;
    var initial = profile.displayName.trim().charAt(0).toUpperCase() || "N";
    el.profileUsername.textContent = profile.displayName;
    el.profileHandle.textContent = "@" + profile.username;
    el.profileBio.textContent = profile.bio || "No bio yet.";
    el.profileAvatar.textContent = initial;
    el.topAvatar.textContent = initial;
    el.topUsername.textContent = profile.displayName;
    el.statFriends.textContent = state.friends.length;
    el.statFavorites.textContent = state.favorites.length;
    el.statPlayed.textContent = state.recent.length;
    renderGameGrid(el.profileFavorites, state.favorites.map(findExperience).filter(Boolean));
    setGreeting();
  }

  function renderNotifications() {
    var unread = state.notifications.filter(function (n) { return n.unread; }).length;
    el.notificationBadge.textContent = unread;
    el.notificationBadge.dataset.count = String(unread);
    el.notificationList.innerHTML = "";

    if (!state.notifications.length) {
      el.notificationList.innerHTML = '<div class="empty-state"><div class="empty-icon">♢</div><h3>All caught up</h3><p>No notifications yet.</p></div>';
      return;
    }

    state.notifications.forEach(function (note) {
      var item = document.createElement("div");
      item.className = "notification-item " + (note.unread ? "unread" : "");
      item.innerHTML =
        '<div class="notification-dot">' + notificationIcon(note.type) + '</div>' +
        '<div><strong>' + escapeHtml(note.title) + '</strong><p>' + escapeHtml(note.body) + '</p></div>';
      item.addEventListener("click", function () {
        note.unread = false;
        saveState();
        renderNotifications();
      });
      el.notificationList.appendChild(item);
    });
  }

  function renderCounters() {
    el.requestCount.textContent = state.incomingRequests.length;
    el.friendsCount.textContent = state.friends.length;
    el.requestsTabCount.textContent = state.incomingRequests.length + state.outgoingRequests.length;
  }

  function openProfileModal() {
    el.editDisplayName.value = state.profile.displayName;
    el.editUsername.value = state.profile.username;
    el.editBio.value = state.profile.bio;
    el.profileModal.showModal();
  }

  function handleProfileSubmit(event) {
    if (event.submitter && event.submitter.value === "cancel") return;
    event.preventDefault();
    var displayName = el.editDisplayName.value.trim();
    var username = normalizeUsername(el.editUsername.value);
    if (!displayName || !username) return;

    state.profile.displayName = displayName;
    state.profile.username = username;
    state.profile.bio = el.editBio.value.trim();
    saveState();
    renderProfile();
    el.profileModal.close();
    toast("Profile updated.");
  }

  function handleFriendSubmit(event) {
    if (event.submitter && event.submitter.value === "cancel") return;
    event.preventDefault();
    var username = normalizeUsername(el.friendUsername.value);
    if (!username) return;

    var known = people.find(function (person) { return person.handle.toLowerCase() === username.toLowerCase(); });
    if (known && state.friends.indexOf(known.id) !== -1) {
      toast("You are already friends with @" + username + ".");
      return;
    }

    if (state.outgoingRequests.indexOf(username) === -1) state.outgoingRequests.push(username);
    saveState();
    renderFriends();
    el.addFriendModal.close();
    toast("Friend request sent to @" + username + ".");
  }

  function normalizeUsername(value) {
    return value.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  }

  function openNotifications() {
    el.notificationDrawer.classList.add("open");
    el.notificationDrawer.setAttribute("aria-hidden", "false");
    el.scrim.classList.add("visible");
  }

  function closeNotifications() {
    el.notificationDrawer.classList.remove("open");
    el.notificationDrawer.setAttribute("aria-hidden", "true");
    if (!el.sidebar.classList.contains("open")) el.scrim.classList.remove("visible");
  }

  function toggleMenu() {
    var open = el.sidebar.classList.toggle("open");
    el.scrim.classList.toggle("visible", open);
    closeNotifications();
    if (open) el.scrim.classList.add("visible");
  }

  function closeMobilePanels() {
    el.sidebar.classList.remove("open");
    closeNotifications();
    el.scrim.classList.remove("visible");
  }

  function findExperience(id) {
    return experiences.find(function (game) { return game.id === id; });
  }

  function findPerson(id) {
    return people.find(function (person) { return person.id === id; });
  }

  function notificationIcon(type) {
    if (type === "friend") return "◎";
    if (type === "game") return "◫";
    return "◇";
  }

  function formatNumber(value) {
    if (value >= 1000) return (value / 1000).toFixed(value >= 10000 ? 0 : 1) + "K";
    return String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message) {
    var node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    el.toastStack.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 2600);
  }
})();