(function () {
  "use strict";

  var DEFAULTS = {
    skin: "#d3a17d",
    shirt: "#33465f",
    pants: "#252b34",
    headScale: 1,
    bodyScale: 1
  };

  function mount(container, initial) {
    if (!window.THREE) throw new Error("Three.js is required for the avatar editor.");

    container.innerHTML = "";
    var appearance = Object.assign({}, DEFAULTS, initial || {});
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101318);

    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(5.2, 3.8, 7.2);
    camera.lookAt(0, 1.8, 0);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x303848, 2.1));
    var key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    scene.add(key);

    var floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 64),
      new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(2.15, 2.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x59606b, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    var avatar = new THREE.Group();
    scene.add(avatar);

    var mats = {
      skin: new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.72 }),
      shirt: new THREE.MeshStandardMaterial({ color: appearance.shirt, roughness: 0.78 }),
      pants: new THREE.MeshStandardMaterial({ color: appearance.pants, roughness: 0.82 })
    };

    function box(w, h, d, material, x, y, z) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      avatar.add(mesh);
      return mesh;
    }

    var parts = {
      head: box(1.25, 1.15, 1.15, mats.skin, 0, 3.65, 0),
      torso: box(1.65, 1.75, 0.9, mats.shirt, 0, 2.15, 0),
      leftArm: box(0.58, 1.75, 0.62, mats.skin, -1.17, 2.16, 0),
      rightArm: box(0.58, 1.75, 0.62, mats.skin, 1.17, 2.16, 0),
      leftLeg: box(0.72, 1.75, 0.76, mats.pants, -0.46, 0.45, 0),
      rightLeg: box(0.72, 1.75, 0.76, mats.pants, 0.46, 0.45, 0)
    };

    var face = new THREE.Group();
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x181a1e });
    [-0.27, 0.27].forEach(function (x) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.04), eyeMat);
      eye.position.set(x, 3.73, 0.59);
      face.add(eye);
    });
    var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.04), eyeMat);
    mouth.position.set(0, 3.42, 0.59);
    face.add(mouth);
    avatar.add(face);

    var dragging = false;
    var lastX = 0;
    var targetRotation = -0.35;

    renderer.domElement.addEventListener("pointerdown", function (event) {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      targetRotation += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
    });
    renderer.domElement.addEventListener("pointerup", function () { dragging = false; });

    function apply() {
      mats.skin.color.set(appearance.skin);
      mats.shirt.color.set(appearance.shirt);
      mats.pants.color.set(appearance.pants);
      parts.head.scale.setScalar(Number(appearance.headScale || 1));
      var bodyScale = Number(appearance.bodyScale || 1);
      parts.torso.scale.x = bodyScale;
      parts.leftArm.position.x = -1.17 * bodyScale;
      parts.rightArm.position.x = 1.17 * bodyScale;
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
    apply();

    var alive = true;
    function animate(time) {
      if (!alive) return;
      requestAnimationFrame(animate);
      avatar.rotation.y += (targetRotation - avatar.rotation.y) * 0.12;
      avatar.position.y = Math.sin(time * 0.0018) * 0.025;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    return {
      set: function (next) {
        appearance = Object.assign({}, appearance, next || {});
        apply();
      },
      get: function () { return Object.assign({}, appearance); },
      randomize: function () {
        var palette = ["#d5a27d","#bd825f","#8d5d43","#e1b291","#6e4738"];
        var shirts = ["#33465f","#68434a","#3f6247","#5d4772","#2b5662","#715d36"];
        var pants = ["#252b34","#1d2229","#343039","#252b28"];
        appearance.skin = palette[Math.floor(Math.random() * palette.length)];
        appearance.shirt = shirts[Math.floor(Math.random() * shirts.length)];
        appearance.pants = pants[Math.floor(Math.random() * pants.length)];
        appearance.headScale = [0.9, 1, 1.1][Math.floor(Math.random() * 3)];
        appearance.bodyScale = [0.9, 1, 1.1][Math.floor(Math.random() * 3)];
        apply();
        return this.get();
      },
      destroy: function () {
        alive = false;
        observer.disconnect();
        renderer.dispose();
        container.innerHTML = "";
      }
    };
  }

  window.NukaAvatar3D = { mount: mount, defaults: DEFAULTS };
})();