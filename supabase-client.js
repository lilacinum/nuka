(function () {
  "use strict";

  var cfg = window.NUKA_CONFIG || {};
  var client = null;
  var session = null;
  var profile = null;
  var listeners = [];
  var DEMO_DM_KEY = "nuka-demo-dms-v1";

  var demoProfiles = [
    { id: "demo-miles", username: "miles", display_name: "Miles", bio: "Driving around Night Drive 06.", avatar_data: { skin: "#d6a477", shirt: "#25364f", pants: "#1e232b" } },
    { id: "demo-juno", username: "jun0", display_name: "Juno", bio: "UI, maps, and whatever else looks cool.", avatar_data: { skin: "#d5aa8b", shirt: "#573e74", pants: "#25232f" } },
    { id: "demo-kevin", username: "kevbox", display_name: "Kevin", bio: "Mostly here for obbies.", avatar_data: { skin: "#c79873", shirt: "#315a70", pants: "#272c33" } },
    { id: "demo-luca", username: "lucamakes", display_name: "Luca", bio: "Building in Studio more than actually playing.", avatar_data: { skin: "#d5a17b", shirt: "#3c6948", pants: "#262c27" } },
    { id: "demo-sora", username: "sorablue", display_name: "Sora", bio: "Adventure games and late-night hangouts.", avatar_data: { skin: "#d9aa86", shirt: "#445a91", pants: "#202637" } },
    { id: "demo-nova", username: "novaexe", display_name: "Nova", bio: "Breaking prototypes so they get better.", avatar_data: { skin: "#cfa080", shirt: "#7d415d", pants: "#2f2328" } }
  ];

  function enabled() {
    return !!(window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  function initClient() {
    if (client || !enabled()) return client;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  async function init() {
    initClient();
    if (!client) {
      emit();
      return { enabled: false, session: null, profile: null };
    }

    var response = await client.auth.getSession();
    session = response.data.session || null;
    if (session) await loadOwnProfile();

    client.auth.onAuthStateChange(async function (_event, nextSession) {
      session = nextSession || null;
      profile = null;
      if (session) await loadOwnProfile();
      emit();
    });

    emit();
    return { enabled: true, session: session, profile: profile };
  }

  function emit() {
    var detail = { enabled: enabled(), session: session, profile: profile };
    listeners.forEach(function (fn) {
      try { fn(detail); } catch (_error) {}
    });
    window.dispatchEvent(new CustomEvent("nuka:auth", { detail: detail }));
  }

  function onAuth(fn) {
    listeners.push(fn);
    fn({ enabled: enabled(), session: session, profile: profile });
    return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
  }

  async function loadOwnProfile() {
    if (!client || !session) return null;
    var result = await client.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (result.error) throw result.error;
    profile = result.data || null;
    return profile;
  }

  async function signUp(payload) {
    if (!client) throw new Error("Supabase is not configured.");
    var result = await client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          username: normalizeUsername(payload.username),
          display_name: String(payload.displayName || payload.username || "Player").slice(0, 24)
        }
      }
    });
    if (result.error) throw result.error;
    session = result.data.session || null;
    if (session) await loadOwnProfile();
    emit();
    return result.data;
  }

  async function signIn(email, password) {
    if (!client) throw new Error("Supabase is not configured.");
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    session = result.data.session || null;
    await loadOwnProfile();
    emit();
    return result.data;
  }

  async function signOut() {
    if (!client) return;
    var result = await client.auth.signOut();
    if (result.error) throw result.error;
    session = null;
    profile = null;
    emit();
  }

  async function saveProfile(input) {
    if (!client || !session) return null;
    var next = {
      id: session.user.id,
      username: normalizeUsername(input.username),
      display_name: String(input.displayName || "Player").slice(0, 24),
      bio: String(input.bio || "").slice(0, 160),
      avatar_data: input.avatarData || (profile && profile.avatar_data) || {},
      updated_at: new Date().toISOString()
    };
    var result = await client.from("profiles").upsert(next).select("*").single();
    if (result.error) throw result.error;
    profile = result.data;
    emit();
    return profile;
  }

  async function saveAvatar(avatarData) {
    if (!client || !session) return null;
    var result = await client.from("profiles")
      .update({ avatar_data: avatarData, updated_at: new Date().toISOString() })
      .eq("id", session.user.id)
      .select("*")
      .single();
    if (result.error) throw result.error;
    profile = result.data;
    emit();
    return profile;
  }

  async function searchProfiles(query) {
    var q = String(query || "").trim();
    if (!client) {
      var lower = q.toLowerCase();
      return demoProfiles.filter(function (item) {
        return !lower || item.username.toLowerCase().indexOf(lower) !== -1 || item.display_name.toLowerCase().indexOf(lower) !== -1;
      }).slice(0, 12);
    }

    var request = client.from("profiles").select("id,username,display_name,bio,avatar_data,created_at").limit(12);
    if (q) request = request.or("username.ilike.%" + safeFilter(q) + "%,display_name.ilike.%" + safeFilter(q) + "%");
    var result = await request;
    if (result.error) throw result.error;
    return (result.data || []).filter(function (item) { return !session || item.id !== session.user.id; });
  }

  async function getProfileByUsername(username) {
    var handle = normalizeUsername(username);
    if (!client) {
      return demoProfiles.find(function (item) { return item.username.toLowerCase() === handle.toLowerCase(); }) || null;
    }
    var result = await client.from("profiles").select("*").eq("username", handle).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function sendFriendRequest(target) {
    if (!client || !session) throw new Error("Sign in to send real friend requests.");
    var targetId = typeof target === "string" && target.indexOf("-") !== -1 ? target : null;
    if (!targetId) {
      var found = await getProfileByUsername(target.username || target);
      targetId = found && found.id;
    }
    if (!targetId) throw new Error("User not found.");
    var result = await client.from("friendships").insert({
      requester_id: session.user.id,
      addressee_id: targetId,
      status: "pending"
    });
    if (result.error) throw result.error;
    return true;
  }

  function demoThreadKey(peer) {
    return String((peer && (peer.username || peer.id)) || "unknown").toLowerCase();
  }

  function readDemoDms() {
    try { return JSON.parse(localStorage.getItem(DEMO_DM_KEY)) || {}; }
    catch (_error) { return {}; }
  }

  function writeDemoDms(data) {
    localStorage.setItem(DEMO_DM_KEY, JSON.stringify(data));
  }

  async function loadDm(peer) {
    if (!client || !session) {
      var all = readDemoDms();
      var key = demoThreadKey(peer);
      if (!all[key]) {
        all[key] = [
          { id: "welcome-" + key, sender: "peer", body: "yo, this is the new Nuka message system", created_at: new Date(Date.now() - 300000).toISOString() }
        ];
        writeDemoDms(all);
      }
      return all[key];
    }

    var me = session.user.id;
    var result = await client.from("messages")
      .select("id,sender_id,recipient_id,body,created_at")
      .or("and(sender_id.eq." + me + ",recipient_id.eq." + peer.id + "),and(sender_id.eq." + peer.id + ",recipient_id.eq." + me + ")")
      .order("created_at", { ascending: true })
      .limit(200);
    if (result.error) throw result.error;
    return (result.data || []).map(function (message) {
      return {
        id: message.id,
        sender: message.sender_id === me ? "me" : "peer",
        body: message.body,
        created_at: message.created_at
      };
    });
  }

  async function sendDm(peer, body) {
    var text = String(body || "").trim().slice(0, 1000);
    if (!text) return null;

    if (!client || !session) {
      var all = readDemoDms();
      var key = demoThreadKey(peer);
      all[key] = all[key] || [];
      var message = { id: "demo-" + Date.now(), sender: "me", body: text, created_at: new Date().toISOString() };
      all[key].push(message);
      writeDemoDms(all);
      window.dispatchEvent(new CustomEvent("nuka:demo-message", { detail: { peer: key, message: message } }));
      return message;
    }

    var result = await client.from("messages").insert({
      sender_id: session.user.id,
      recipient_id: peer.id,
      body: text
    }).select("id,sender_id,recipient_id,body,created_at").single();
    if (result.error) throw result.error;
    return {
      id: result.data.id,
      sender: "me",
      body: result.data.body,
      created_at: result.data.created_at
    };
  }

  function subscribeDm(peer, callback) {
    if (!client || !session) {
      var handler = function (event) {
        if (event.detail.peer === demoThreadKey(peer)) callback(event.detail.message);
      };
      window.addEventListener("nuka:demo-message", handler);
      return function () { window.removeEventListener("nuka:demo-message", handler); };
    }

    var me = session.user.id;
    var channel = client.channel("dm:" + [me, peer.id].sort().join(":"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (payload) {
        var row = payload.new;
        var belongs = (row.sender_id === me && row.recipient_id === peer.id) || (row.sender_id === peer.id && row.recipient_id === me);
        if (!belongs) return;
        callback({
          id: row.id,
          sender: row.sender_id === me ? "me" : "peer",
          body: row.body,
          created_at: row.created_at
        });
      })
      .subscribe();

    return function () { client.removeChannel(channel); };
  }

  function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  }

  function safeFilter(value) {
    return String(value || "").replace(/[,%()]/g, "");
  }

  window.NukaBackend = {
    init: init,
    enabled: enabled,
    onAuth: onAuth,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    saveProfile: saveProfile,
    saveAvatar: saveAvatar,
    searchProfiles: searchProfiles,
    getProfileByUsername: getProfileByUsername,
    sendFriendRequest: sendFriendRequest,
    loadDm: loadDm,
    sendDm: sendDm,
    subscribeDm: subscribeDm,
    getClient: function () { return client; },
    getSession: function () { return session; },
    getUser: function () { return session && session.user; },
    getProfile: function () { return profile; },
    demoProfiles: demoProfiles
  };
})();