(function () {
  "use strict";

  var backend = window.NukaBackend;
  var avatarEditor = null;
  var world = null;
  var activePeer = null;
  var unsubscribeDm = null;
  var currentAvatar = loadAvatar();

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cache();
    bind();
    updateAvatarSwatches();
    try { await backend.init(); } catch (error) { toast(error.message); }
    backend.onAuth(renderAccountState);
  }

  function cache() {
    window.NukaSocialUI = {
      accountButton: document.getElementById("accountButton"),
      authModal: document.getElementById("authModal"),
      authForm: document.getElementById("authForm"),
      authMode: document.getElementById("authMode"),
      authEmail: document.getElementById("authEmail"),
      authPassword: document.getElementById("authPassword"),
      authUsernameRow: document.getElementById("authUsernameRow"),
      authDisplayNameRow: document.getElementById("authDisplayNameRow"),
      authUsername: document.getElementById("authUsername"),
      authDisplayName: document.getElementById("authDisplayName"),
      authSubmit: document.getElementById("authSubmit"),
      authSwitch: document.getElementById("authSwitch"),
      authStatus: document.getElementById("authStatus"),
      findPeopleButton: document.getElementById("findPeopleButton"),
      peopleModal: document.getElementById("peopleModal"),
      peopleSearch: document.getElementById("peopleSearch"),
      peopleResults: document.getElementById("peopleResults"),
      publicProfileModal: document.getElementById("publicProfileModal"),
      publicProfileBody: document.getElementById("publicProfileBody"),
      publicProfileMessage: document.getElementById("publicProfileMessage"),
      publicProfileAdd: document.getElementById("publicProfileAdd"),
      messagesButton: document.getElementById("messagesButton"),
      dmDrawer: document.getElementById("dmDrawer"),
      closeDm: document.getElementById("closeDm"),
      dmPeer: document.getElementById("dmPeer"),
      dmMessages: document.getElementById("dmMessages"),
      dmForm: document.getElementById("dmForm"),
      dmInput: document.getElementById("dmInput"),
      editAvatarButton: document.getElementById("editAvatarButton"),
      avatarModal: document.getElementById("avatarModal"),
      avatarCanvas: document.getElementById("avatarCanvas"),
      avatarSkin: document.getElementById("avatarSkin"),
      avatarShirt: document.getElementById("avatarShirt"),
      avatarPants: document.getElementById("avatarPants"),
      avatarHeadScale: document.getElementById("avatarHeadScale"),
      avatarBodyScale: document.getElementById("avatarBodyScale"),
      randomizeAvatar: document.getElementById("randomizeAvatar"),
      saveAvatar: document.getElementById("saveAvatar"),
      enterWorldButton: document.getElementById("enterWorldButton"),
      worldModal: document.getElementById("worldModal"),
      worldCanvas: document.getElementById("worldCanvas"),
      worldPresence: document.getElementById("worldPresence"),
      closeWorld: document.getElementById("closeWorld")
    };
  }

  function bind() {
    var ui = window.NukaSocialUI;

    ui.accountButton.addEventListener("click", handleAccountClick);
    ui.authMode.addEventListener("change", updateAuthMode);
    ui.authSwitch.addEventListener("click", function () {
      ui.authMode.value = ui.authMode.value === "signin" ? "signup" : "signin";
      updateAuthMode();
    });
    ui.authForm.addEventListener("submit", submitAuth);

    ui.findPeopleButton.addEventListener("click", openPeople);
    ui.peopleSearch.addEventListener("input", debounce(searchPeople, 160));

    ui.publicProfileMessage.addEventListener("click", function () {
      var profile = ui.publicProfileModal._profile;
      if (!profile) return;
      ui.publicProfileModal.close();
      openDm(profile);
    });
    ui.publicProfileAdd.addEventListener("click", async function () {
      var profile = ui.publicProfileModal._profile;
      if (!profile) return;
      try {
        if (backend.enabled()) {
          await backend.sendFriendRequest(profile);
          toast("Friend request sent to @" + profile.username + ".");
        } else {
          toast("Demo mode: connect Supabase to send a real friend request.");
        }
      } catch (error) { toast(error.message); }
    });

    ui.messagesButton.addEventListener("click", openMessagePicker);
    ui.closeDm.addEventListener("click", closeDm);
    ui.dmForm.addEventListener("submit", sendDm);

    ui.editAvatarButton.addEventListener("click", openAvatar);
    ui.avatarModal.addEventListener("close", destroyAvatarEditor);
    [ui.avatarSkin, ui.avatarShirt, ui.avatarPants, ui.avatarHeadScale, ui.avatarBodyScale].forEach(function (input) {
      input.addEventListener("input", syncAvatarControls);
    });
    ui.randomizeAvatar.addEventListener("click", function () {
      if (!avatarEditor) return;
      currentAvatar = avatarEditor.randomize();
      fillAvatarControls();
    });
    ui.saveAvatar.addEventListener("click", saveAvatar);

    ui.enterWorldButton.addEventListener("click", openWorld);
    ui.closeWorld.addEventListener("click", function () { ui.worldModal.close(); });
    ui.worldModal.addEventListener("close", destroyWorld);

    document.addEventListener("click", interceptFriendMessage, true);

    var profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", function (event) {
        if (event.submitter && event.submitter.value === "cancel") return;
        setTimeout(syncProfileToBackend, 0);
      }, true);
    }
  }

  function renderAccountState(detail) {
    var ui = window.NukaSocialUI;
    if (!detail.enabled) {
      ui.accountButton.textContent = "Demo mode";
      ui.accountButton.dataset.state = "demo";
      return;
    }
    if (detail.session) {
      ui.accountButton.textContent = (detail.profile && ("@" + detail.profile.username)) || "Account";
      ui.accountButton.dataset.state = "signedin";
    } else {
      ui.accountButton.textContent = "Sign in";
      ui.accountButton.dataset.state = "signedout";
    }
  }

  function handleAccountClick() {
    var ui = window.NukaSocialUI;
    if (!backend.enabled()) {
      ui.authStatus.innerHTML = 'Supabase is not configured yet. Add your project URL and anon key in <code>config.js</code> to turn on real accounts.';
      ui.authSubmit.disabled = true;
      ui.authModal.showModal();
      return;
    }

    if (backend.getSession()) {
      if (confirm("Sign out of Nuka?")) {
        backend.signOut().catch(function (error) { toast(error.message); });
      }
      return;
    }

    ui.authSubmit.disabled = false;
    ui.authStatus.textContent = "";
    ui.authModal.showModal();
  }

  function updateAuthMode() {
    var ui = window.NukaSocialUI;
    var signup = ui.authMode.value === "signup";
    ui.authUsernameRow.classList.toggle("hidden", !signup);
    ui.authDisplayNameRow.classList.toggle("hidden", !signup);
    ui.authSubmit.textContent = signup ? "Create account" : "Sign in";
    ui.authSwitch.textContent = signup ? "Already have an account?" : "Need an account?";
  }

  async function submitAuth(event) {
    event.preventDefault();
    var ui = window.NukaSocialUI;
    ui.authSubmit.disabled = true;
    ui.authStatus.textContent = "Working…";
    try {
      if (ui.authMode.value === "signup") {
        var data = await backend.signUp({
          email: ui.authEmail.value.trim(),
          password: ui.authPassword.value,
          username: ui.authUsername.value.trim(),
          displayName: ui.authDisplayName.value.trim()
        });
        ui.authStatus.textContent = data.session ? "Account created." : "Account created. Check your email if confirmation is enabled.";
      } else {
        await backend.signIn(ui.authEmail.value.trim(), ui.authPassword.value);
        ui.authStatus.textContent = "Signed in.";
      }
      if (backend.getSession()) setTimeout(function () { ui.authModal.close(); }, 300);
    } catch (error) {
      ui.authStatus.textContent = error.message || "Authentication failed.";
    } finally {
      ui.authSubmit.disabled = false;
    }
  }

  async function openPeople() {
    var ui = window.NukaSocialUI;
    ui.peopleSearch.value = "";
    ui.peopleModal.showModal();
    await searchPeople();
    setTimeout(function () { ui.peopleSearch.focus(); }, 50);
  }

  async function searchPeople() {
    var ui = window.NukaSocialUI;
    ui.peopleResults.innerHTML = '<div class="people-loading">Searching…</div>';
    try {
      var profiles = await backend.searchProfiles(ui.peopleSearch.value);
      ui.peopleResults.innerHTML = "";
      if (!profiles.length) {
        ui.peopleResults.innerHTML = '<div class="empty-state compact"><h3>No people found</h3><p>Try another username.</p></div>';
        return;
      }
      profiles.forEach(function (profile) {
        var row = document.createElement("button");
        row.className = "profile-search-row";
        row.innerHTML =
          '<span class="profile-result-avatar" style="--avatar-color:' + avatarColor(profile) + '">' + escapeHtml((profile.display_name || profile.username || "?").charAt(0).toUpperCase()) + '</span>' +
          '<span><strong>' + escapeHtml(profile.display_name || profile.username) + '</strong><small>@' + escapeHtml(profile.username) + '</small></span>' +
          '<span class="profile-row-arrow">›</span>';
        row.addEventListener("click", function () { showPublicProfile(profile); });
        ui.peopleResults.appendChild(row);
      });
    } catch (error) {
      ui.peopleResults.innerHTML = '<div class="empty-state compact"><h3>Could not search</h3><p>' + escapeHtml(error.message) + '</p></div>';
    }
  }

  function showPublicProfile(profile) {
    var ui = window.NukaSocialUI;
    ui.publicProfileModal._profile = profile;
    ui.publicProfileBody.innerHTML =
      '<div class="public-profile-card">' +
        '<div class="public-profile-avatar" style="--avatar-color:' + avatarColor(profile) + '">' + escapeHtml((profile.display_name || profile.username).charAt(0).toUpperCase()) + '</div>' +
        '<div><p class="eyebrow">PUBLIC PROFILE</p><h2>' + escapeHtml(profile.display_name || profile.username) + '</h2><p class="public-handle">@' + escapeHtml(profile.username) + '</p></div>' +
      '</div>' +
      '<p class="public-bio">' + escapeHtml(profile.bio || "No bio yet.") + '</p>';
    ui.peopleModal.close();
    ui.publicProfileModal.showModal();
  }

  function interceptFriendMessage(event) {
    var button = event.target.closest && event.target.closest('[data-action="message"]');
    if (!button) return;
    var row = button.closest(".friend-row");
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var copy = row.querySelector(".friend-copy");
    var strong = copy && copy.querySelector("strong");
    var p = copy && copy.querySelector("p");
    var handleMatch = p && p.textContent.match(/@([A-Za-z0-9_]+)/);
    var handle = handleMatch ? handleMatch[1] : (strong ? strong.textContent : "player");
    backend.getProfileByUsername(handle).then(function (profile) {
      openDm(profile || { id: "demo-" + handle, username: handle, display_name: strong ? strong.textContent : handle });
    }).catch(function () {
      openDm({ id: "demo-" + handle, username: handle, display_name: strong ? strong.textContent : handle });
    });
  }

  async function openMessagePicker() {
    var ui = window.NukaSocialUI;
    ui.peopleSearch.value = "";
    ui.peopleModal.showModal();
    await searchPeople();
    toast("Choose a profile to open a conversation.");
  }

  async function openDm(peer) {
    var ui = window.NukaSocialUI;
    activePeer = peer;
    ui.dmPeer.textContent = (peer.display_name || peer.username) + "  @" + peer.username;
    ui.dmMessages.innerHTML = '<div class="people-loading">Loading messages…</div>';
    ui.dmDrawer.classList.add("open");
    if (unsubscribeDm) unsubscribeDm();

    try {
      var messages = await backend.loadDm(peer);
      renderMessages(messages);
      unsubscribeDm = backend.subscribeDm(peer, function (message) {
        appendMessage(message);
      });
    } catch (error) {
      ui.dmMessages.innerHTML = '<div class="empty-state compact"><h3>Could not load messages</h3><p>' + escapeHtml(error.message) + '</p></div>';
    }
  }

  function closeDm() {
    var ui = window.NukaSocialUI;
    ui.dmDrawer.classList.remove("open");
    if (unsubscribeDm) unsubscribeDm();
    unsubscribeDm = null;
    activePeer = null;
  }

  function renderMessages(messages) {
    var ui = window.NukaSocialUI;
    ui.dmMessages.innerHTML = "";
    if (!messages.length) {
      ui.dmMessages.innerHTML = '<div class="dm-empty">No messages yet. Say something.</div>';
      return;
    }
    messages.forEach(appendMessage);
    ui.dmMessages.scrollTop = ui.dmMessages.scrollHeight;
  }

  function appendMessage(message) {
    var ui = window.NukaSocialUI;
    var node = document.createElement("div");
    node.className = "dm-message " + (message.sender === "me" ? "mine" : "theirs");
    node.innerHTML = '<div>' + escapeHtml(message.body) + '</div><time>' + formatTime(message.created_at) + '</time>';
    ui.dmMessages.appendChild(node);
    ui.dmMessages.scrollTop = ui.dmMessages.scrollHeight;
  }

  async function sendDm(event) {
    event.preventDefault();
    var ui = window.NukaSocialUI;
    if (!activePeer) return;
    var body = ui.dmInput.value.trim();
    if (!body) return;
    ui.dmInput.value = "";
    try {
      await backend.sendDm(activePeer, body);
    } catch (error) { toast(error.message); }
  }

  function openAvatar() {
    var ui = window.NukaSocialUI;
    ui.avatarModal.showModal();
    fillAvatarControls();
    avatarEditor = window.NukaAvatar3D.mount(ui.avatarCanvas, currentAvatar);
  }

  function fillAvatarControls() {
    var ui = window.NukaSocialUI;
    ui.avatarSkin.value = currentAvatar.skin || "#d3a17d";
    ui.avatarShirt.value = currentAvatar.shirt || "#33465f";
    ui.avatarPants.value = currentAvatar.pants || "#252b34";
    ui.avatarHeadScale.value = currentAvatar.headScale || 1;
    ui.avatarBodyScale.value = currentAvatar.bodyScale || 1;
    updateAvatarSwatches();
  }

  function syncAvatarControls() {
    var ui = window.NukaSocialUI;
    currentAvatar = {
      skin: ui.avatarSkin.value,
      shirt: ui.avatarShirt.value,
      pants: ui.avatarPants.value,
      headScale: Number(ui.avatarHeadScale.value),
      bodyScale: Number(ui.avatarBodyScale.value)
    };
    if (avatarEditor) avatarEditor.set(currentAvatar);
    updateAvatarSwatches();
  }

  async function saveAvatar() {
    var ui = window.NukaSocialUI;
    syncAvatarControls();
    localStorage.setItem("nuka-avatar-v1", JSON.stringify(currentAvatar));
    try {
      if (backend.enabled() && backend.getSession()) await backend.saveAvatar(currentAvatar);
      toast("Avatar saved.");
      ui.avatarModal.close();
    } catch (error) { toast(error.message); }
  }

  function destroyAvatarEditor() {
    if (avatarEditor) avatarEditor.destroy();
    avatarEditor = null;
  }

  function updateAvatarSwatches() {
    var mini = document.getElementById("avatarMiniPreview");
    if (!mini) return;
    mini.style.setProperty("--skin", currentAvatar.skin || "#d3a17d");
    mini.style.setProperty("--shirt", currentAvatar.shirt || "#33465f");
    mini.style.setProperty("--pants", currentAvatar.pants || "#252b34");
  }

  function openWorld() {
    var ui = window.NukaSocialUI;
    ui.worldModal.showModal();
    ui.worldPresence.textContent = "Connecting…";
    world = window.NukaWorld.mount(ui.worldCanvas, {
      appearance: currentAvatar,
      onPresence: function (count) {
        ui.worldPresence.textContent = count + (count === 1 ? " player" : " players") + " in Lobby";
      }
    });
  }

  function destroyWorld() {
    if (world) world.destroy();
    world = null;
  }

  async function syncProfileToBackend() {
    if (!backend.enabled() || !backend.getSession()) return;
    var displayName = document.getElementById("editDisplayName");
    var username = document.getElementById("editUsername");
    var bio = document.getElementById("editBio");
    try {
      await backend.saveProfile({
        displayName: displayName.value,
        username: username.value,
        bio: bio.value,
        avatarData: currentAvatar
      });
    } catch (error) { toast("Saved locally, but Supabase sync failed: " + error.message); }
  }

  function loadAvatar() {
    try {
      return Object.assign({}, window.NukaAvatar3D ? window.NukaAvatar3D.defaults : {}, JSON.parse(localStorage.getItem("nuka-avatar-v1")) || {});
    } catch (_error) {
      return { skin:"#d3a17d", shirt:"#33465f", pants:"#252b34", headScale:1, bodyScale:1 };
    }
  }

  function avatarColor(profile) {
    return (profile.avatar_data && profile.avatar_data.shirt) || "#55606f";
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function formatTime(value) {
    var date = new Date(value || Date.now());
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
    var stack = document.getElementById("toastStack");
    if (!stack) return;
    var node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(function () { node.remove(); }, 3200);
  }
})();