(function () {
  "use strict";

  function mount(container, options) {
    options = options || {};
    if (!window.THREE) throw new Error("Three.js is required for the world.");

    container.innerHTML = "";
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1116);
    scene.fog = new THREE.Fog(0x0e1116, 28, 85);

    var camera = new THREE.PerspectiveCamera(64, 1, 0.1, 160);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x20232a, 1.75));
    var sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(15, 28, 10);
    sun.castShadow = true;
    scene.add(sun);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x242a31, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    var grid = new THREE.GridHelper(120, 60, 0x454b54, 0x30353d);
    grid.position.y = 0.01;
    scene.add(grid);

    var buildingMat = new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 0.92 });
    var accentMat = new THREE.MeshStandardMaterial({ color: 0x666f7c, roughness: 0.75 });
    [
      [-12, 3, -10, 7, 6, 7], [11, 4, -14, 8, 8, 6], [-18, 2.5, 10, 5, 5, 8],
      [16, 5, 13, 9, 10, 7], [0, 2, -25, 12, 4, 5]
    ].forEach(function (b, i) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(b[3], b[4], b[5]), i % 2 ? accentMat : buildingMat);
      mesh.position.set(b[0], b[1], b[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    function createAvatar(appearance) {
      appearance = Object.assign({ skin: "#d3a17d", shirt: "#33465f", pants: "#252b34" }, appearance || {});
      var group = new THREE.Group();
      var skin = new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: .8 });
      var shirt = new THREE.MeshStandardMaterial({ color: appearance.shirt, roughness: .8 });
      var pants = new THREE.MeshStandardMaterial({ color: appearance.pants, roughness: .85 });
      function part(w,h,d,mat,x,y,z) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
        m.position.set(x,y,z);
        m.castShadow = true;
        group.add(m);
      }
      part(.9,.85,.8,skin,0,2.75,0);
      part(1.15,1.25,.65,shirt,0,1.72,0);
      part(.42,1.25,.46,skin,-.82,1.72,0);
      part(.42,1.25,.46,skin,.82,1.72,0);
      part(.5,1.25,.52,pants,-.31,.47,0);
      part(.5,1.25,.52,pants,.31,.47,0);
      return group;
    }

    var player = createAvatar(options.appearance);
    scene.add(player);
    player.position.set(0, 0, 7);

    var keys = {};
    var velocityY = 0;
    var grounded = true;
    var yaw = Math.PI;
    var cameraPitch = -0.12;
    var dragging = false;
    var last = { x: 0, y: 0 };
    var remote = {};
    var channel = null;
    var presenceTimer = 0;
    var demoGhosts = [];

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);

    function keyDown(e) {
      keys[e.code] = true;
      if (e.code === "Space" && grounded) {
        velocityY = 6.2;
        grounded = false;
      }
    }
    function keyUp(e) { keys[e.code] = false; }
    function pointerDown(e) {
      dragging = true;
      last.x = e.clientX;
      last.y = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function pointerMove(e) {
      if (!dragging) return;
      yaw -= (e.clientX - last.x) * .004;
      cameraPitch = Math.max(-.55, Math.min(.28, cameraPitch - (e.clientY - last.y) * .003));
      last.x = e.clientX;
      last.y = e.clientY;
    }
    function pointerUp() { dragging = false; }

    function setupPresence() {
      var backend = window.NukaBackend;
      var sb = backend && backend.getClient && backend.getClient();
      var user = backend && backend.getUser && backend.getUser();
      if (!sb || !user) {
        spawnDemoGhosts();
        return;
      }

      channel = sb.channel("nuka-world:lobby", { config: { presence: { key: user.id } } });
      channel
        .on("presence", { event: "sync" }, function () {
          var presence = channel.presenceState();
          var seen = {};
          Object.keys(presence).forEach(function (key) {
            var entry = presence[key] && presence[key][0];
            if (!entry || key === user.id) return;
            seen[key] = true;
            if (!remote[key]) {
              remote[key] = createAvatar(entry.appearance || {});
              scene.add(remote[key]);
            }
            remote[key].position.set(entry.x || 0, entry.y || 0, entry.z || 0);
            remote[key].rotation.y = entry.ry || 0;
          });
          Object.keys(remote).forEach(function (key) {
            if (!seen[key]) {
              scene.remove(remote[key]);
              delete remote[key];
            }
          });
          if (options.onPresence) options.onPresence(Object.keys(seen).length + 1);
        })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") trackPresence();
        });
    }

    function trackPresence() {
      if (!channel) return;
      var backend = window.NukaBackend;
      var p = backend && backend.getProfile && backend.getProfile();
      channel.track({
        username: (p && p.username) || "player",
        x: Number(player.position.x.toFixed(2)),
        y: Number(player.position.y.toFixed(2)),
        z: Number(player.position.z.toFixed(2)),
        ry: Number(player.rotation.y.toFixed(3)),
        appearance: options.appearance || {},
        online_at: new Date().toISOString()
      });
    }

    function spawnDemoGhosts() {
      var ghostData = [
        { p: [-4,0,-3], a: { skin:"#c98f68",shirt:"#5b456e",pants:"#282633" } },
        { p: [6,0,-8], a: { skin:"#d7a27c",shirt:"#31576a",pants:"#242b30" } },
        { p: [2,0,2], a: { skin:"#b97957",shirt:"#456749",pants:"#252c26" } }
      ];
      ghostData.forEach(function (g, i) {
        var mesh = createAvatar(g.a);
        mesh.position.set(g.p[0],g.p[1],g.p[2]);
        scene.add(mesh);
        demoGhosts.push({ mesh: mesh, phase: i * 2.1 });
      });
      if (options.onPresence) options.onPresence(4);
    }

    setupPresence();

    var lastTime = performance.now();
    var alive = true;

    function tick(now) {
      if (!alive) return;
      requestAnimationFrame(tick);
      var dt = Math.min((now - lastTime) / 1000, .033);
      lastTime = now;

      var forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      var strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      var speed = (keys.ShiftLeft || keys.ShiftRight) ? 9.5 : 6.4;

      var sin = Math.sin(yaw);
      var cos = Math.cos(yaw);
      var dx = (forward * sin + strafe * cos) * speed * dt;
      var dz = (forward * cos - strafe * sin) * speed * dt;
      player.position.x += dx;
      player.position.z += dz;

      if (forward || strafe) {
        player.rotation.y = Math.atan2(dx, dz);
      }

      velocityY -= 15 * dt;
      player.position.y += velocityY * dt;
      if (player.position.y <= 0) {
        player.position.y = 0;
        velocityY = 0;
        grounded = true;
      }

      var dist = 7.5;
      var camHeight = 4.5 + cameraPitch * 5;
      camera.position.set(
        player.position.x - Math.sin(yaw) * dist,
        player.position.y + camHeight,
        player.position.z - Math.cos(yaw) * dist
      );
      camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);

      demoGhosts.forEach(function (g, i) {
        g.mesh.position.y = Math.sin(now * .0015 + g.phase) * .05;
        g.mesh.rotation.y += .002 + i * .0004;
      });

      if (channel && now - presenceTimer > 180) {
        presenceTimer = now;
        trackPresence();
      }

      renderer.render(scene, camera);
    }

    function resize() {
      var rect = container.getBoundingClientRect();
      var width = Math.max(1, rect.width);
      var height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    var observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    requestAnimationFrame(tick);

    return {
      destroy: function () {
        alive = false;
        observer.disconnect();
        window.removeEventListener("keydown", keyDown);
        window.removeEventListener("keyup", keyUp);
        renderer.dispose();
        if (channel && window.NukaBackend && window.NukaBackend.getClient()) {
          window.NukaBackend.getClient().removeChannel(channel);
        }
        container.innerHTML = "";
      }
    };
  }

  window.NukaWorld = { mount: mount };
})();