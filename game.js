"use strict";

window.addEventListener("DOMContentLoaded", () => {
  if (typeof THREE === "undefined") {
    console.error("Three.js не загружена! Проверьте подключение библиотеки.");
    return;
  }

  /* =========================
     3D СЦЕНА И КАМЕРА
  ========================= */
  const container = document.getElementById("game-container");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.003);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(100, 150, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 500;
  const d = 150;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* =========================
     СОСТОЯНИЕ ИГРЫ
  ========================= */
  let gameState = "menu";
  let totalCoins = Number(localStorage.getItem("f1_total_coins")) || 0;
  let currentCoinsCollected = 0;
  const MAX_LAPS = 3;

  /* =========================
     УПРАВЛЕНИЕ
  ========================= */
  const keys = { Up: false, Down: false, Left: false, Right: false };

  function setControl(key, value, element) {
    keys[key] = value;
    if (element) element.classList.toggle("active", value);
  }

  function bindTouch(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = e => { e.preventDefault(); setControl(key, true, el); };
    const end = e => { e.preventDefault(); setControl(key, false, el); };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", end);
  }

  bindTouch("btn-gas", "Up");
  bindTouch("btn-brake", "Down");
  bindTouch("btn-left", "Left");
  bindTouch("btn-right", "Right");

  window.addEventListener("keydown", e => {
    if (["ArrowUp", "w", "W"].includes(e.key)) { keys.Up = true; e.preventDefault(); }
    if (["ArrowDown", "s", "S"].includes(e.key)) { keys.Down = true; e.preventDefault(); }
    if (["ArrowLeft", "a", "A"].includes(e.key)) { keys.Left = true; e.preventDefault(); }
    if (["ArrowRight", "d", "D"].includes(e.key)) { keys.Right = true; e.preventDefault(); }
  });

  window.addEventListener("keyup", e => {
    if (["ArrowUp", "w", "W"].includes(e.key)) keys.Up = false;
    if (["ArrowDown", "s", "S"].includes(e.key)) keys.Down = false;
    if (["ArrowLeft", "a", "A"].includes(e.key)) keys.Left = false;
    if (["ArrowRight", "d", "D"].includes(e.key)) keys.Right = false;
  });

  /* =========================
     3D ТРАССА И ОКРУЖЕНИЕ
  ========================= */
  const track2D = [
    {x: 170, y: 190}, {x: 430, y: 130}, {x: 760, y: 130},
    {x: 1030, y: 210}, {x: 1080, y: 400}, {x: 920, y: 555},
    {x: 680, y: 510}, {x: 470, y: 610}, {x: 200, y: 545}, {x: 110, y: 360}
  ];

  const SCALE = 0.5;
  const trackPoints = track2D.map(p => new THREE.Vector3((p.x - 600) * SCALE, 0, (p.y - 350) * SCALE));
  const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);

  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const trackGeo = new THREE.TubeGeometry(trackCurve, 200, 7.5, 8, true);
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.scale.y = 0.05;
  trackMesh.position.y = 0.1;
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);

  const coins = [];
  const coinGroup = new THREE.Group();
  scene.add(coinGroup);

  function createTree(x, z) {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(2.5, 6, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e5622, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  function initEnvironment() {
    for (let i = 0; i < 40; i++) {
      let x = (Math.random() - 0.5) * 500;
      let z = (Math.random() - 0.5) * 500;
      let pointOnCurve = trackCurve.getPointAt(Math.random());
      if (new THREE.Vector3(x, 0, z).distanceTo(pointOnCurve) > 18) {
        createTree(x, z);
      }
    }

    const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 10);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.2 });

    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      const pos = trackCurve.getPointAt(t);
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.x = Math.PI / 2;
      coin.position.set(pos.x, 1.2, pos.z);
      coin.castShadow = true;
      coinGroup.add(coin);
      coins.push({ mesh: coin, collected: false });
    }
  }
  initEnvironment();

  /* =========================
     3D МОДЕЛЬ И КЛАСС МАШИНЫ
  ========================= */
  function createCarMesh(colorHex) {
    const carGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(2.2, 0.8, 4.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.5, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    carGroup.add(body);

    const cabinGeo = new THREE.BoxGeometry(1.4, 0.6, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, -0.2);
    carGroup.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const wheelPositions = [
      [-1.2, 0.4, 1.4], [1.2, 0.4, 1.4],
      [-1.2, 0.4, -1.4], [1.2, 0.4, -1.4]
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    return carGroup;
  }

  class Car {
    constructor(color, isBot = false, name = "Bot") {
      this.mesh = createCarMesh(color);
      scene.add(this.mesh);

      this.isBot = isBot;
      this.name = name;
      this.speed = 0;
      this.maxSpeed = isBot ? 0.9 + Math.random() * 0.2 : 1.25;
      this.accel = isBot ? 0.02 : 0.035;
      this.friction = 0.96;
      this.turnSpeed = isBot ? 0.035 : 0.045;
      
      this.angle = 0;
      this.progress = 0;
      this.completedLaps = 0;
      this.waypointT = 0;
      this.finished = false;
      this.lastT = 0;
    }

    setPosition(x, z, angle) {
      this.mesh.position.set(x, 0, z);
      this.angle = angle;
      this.mesh.rotation.y = angle;
    }

    update() {
      if (this.finished) return;

      if (this.isBot) {
        this.updateBot();
      } else {
        this.updatePlayer();
      }

      this.speed *= this.friction;

      this.mesh.position.x += Math.sin(this.angle) * this.speed;
      this.mesh.position.z += Math.cos(this.angle) * this.speed;
      this.mesh.rotation.y = this.angle;

      this.checkLapProgress();
    }

    updatePlayer() {
      if (keys.Up) this.speed = Math.min(this.speed + this.accel, this.maxSpeed);
      if (keys.Down) this.speed = Math.max(this.speed - this.accel * 1.5, -this.maxSpeed * 0.4);

      if (Math.abs(this.speed) > 0.02) {
        const dir = this.speed >= 0 ? 1 : -1;
        if (keys.Left) this.angle += this.turnSpeed * dir;
        if (keys.Right) this.angle -= this.turnSpeed * dir;
      }
    }

    updateBot() {
      this.waypointT = (this.waypointT + 0.002) % 1;
      const target = trackCurve.getPointAt(this.waypointT);
      
      const dx = target.x - this.mesh.position.x;
      const dz = target.z - this.mesh.position.z;
      const targetAngle = Math.atan2(dx, dz);

      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      this.angle += Math.max(-this.turnSpeed, Math.min(this.turnSpeed, diff));
      this.speed = Math.min(this.speed + this.accel, this.maxSpeed);
    }

    checkLapProgress() {
      let closestT = this.lastT;
      let minDist = Infinity;
      
      for (let offset = -0.05; offset <= 0.05; offset += 0.01) {
        let t = (this.lastT + offset + 1) % 1;
        const p = trackCurve.getPointAt(t);
        const d = p.distanceTo(this.mesh.position);
        if (d < minDist) {
          minDist = d;
          closestT = t;
        }
      }

      if (this.lastT > 0.85 && closestT < 0.15) {
        this.completedLaps++;
        if (!this.isBot) {
          const lapEl = document.getElementById("hud-lap");
          if (lapEl) lapEl.innerText = Math.min(this.completedLaps + 1, MAX_LAPS);
        }
        if (this.completedLaps >= MAX_LAPS) this.finish();
      }

      this.lastT = closestT;
      this.progress = this.completedLaps + closestT;
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      this.speed = 0;
      if (this === player) finishPlayerRace();
    }
  }

  /* =========================
     ИГРОВАЯ ЛОГИКА
  ========================= */
  let cars = [];
  let player = null;

  function startGame() {
    gameState = "playing";
    currentCoinsCollected = 0;

    coins.forEach(c => {
      c.collected = false;
      c.mesh.visible = true;
    });

    cars.forEach(c => scene.remove(c.mesh));
    cars = [];

    const startPoint = trackCurve.getPointAt(0);
    const nextPoint = trackCurve.getPointAt(0.01);
    const startAngle = Math.atan2(nextPoint.x - startPoint.x, nextPoint.z - startPoint.z);

    player = new Car(0xe74c3c, false, "Игрок");
    player.setPosition(startPoint.x, startPoint.z, startAngle);
    cars.push(player);

    const bot1 = new Car(0xf1c40f, true, "Бот 1");
    bot1.setPosition(startPoint.x - 3, startPoint.z - 3, startAngle);
    
    const bot2 = new Car(0x3498db, true, "Бот 2");
    bot2.setPosition(startPoint.x + 3, startPoint.z - 3, startAngle);

    cars.push(bot1, bot2);

    const mainMenu = document.getElementById("main-menu");
    const resultMenu = document.getElementById("result-menu");
    if (mainMenu) mainMenu.style.display = "none";
    if (resultMenu) resultMenu.style.display = "none";
  }

  function updateHUD() {
    const coinsEl = document.getElementById("hud-coins");
    const posEl = document.getElementById("hud-pos");
    
    if (coinsEl) coinsEl.innerText = totalCoins + currentCoinsCollected;
    if (!player || !posEl) return;
    
    const sorted = [...cars].sort((a, b) => b.progress - a.progress);
    posEl.innerText = sorted.indexOf(player) + 1;
  }

  function checkCoinCollisions() {
    if (!player) return;
    coins.forEach(coin => {
      if (!coin.collected && coin.mesh.position.distanceTo(player.mesh.position) < 3) {
        coin.collected = true;
        coin.mesh.visible = false;
        currentCoinsCollected++;
      }
      coin.mesh.rotation.z += 0.05;
    });
  }

  function updateCamera() {
    if (!player) return;

    const offset = new THREE.Vector3(
      -Math.sin(player.angle) * 12,
      6,
      -Math.cos(player.angle) * 12
    );

    const targetCamPos = player.mesh.position.clone().add(offset);
    camera.position.lerp(targetCamPos, 0.1);
    
    const lookAtPos = player.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(lookAtPos);
  }

  function finishPlayerRace() {
    const sorted = [...cars].sort((a, b) => b.progress - a.progress);
    const position = sorted.indexOf(player) + 1;
    const reward = position === 1 ? 200 : (position === 2 ? 50 : 10);
    
    totalCoins += reward + currentCoinsCollected;
    localStorage.setItem("f1_total_coins", totalCoins);

    setTimeout(() => {
      gameState = "ended";
      const title = document.getElementById("res-title");
      if (title) {
        title.innerText = position === 1 ? "🏆 ПОБЕДА!" : "🏁 ФИНИШ!";
        title.style.color = position === 1 ? "#f1c40f" : "#e74c3c";
      }

      const descEl = document.getElementById("res-desc");
      const rewardEl = document.getElementById("res-reward");
      const resMenu = document.getElementById("result-menu");

      if (descEl) descEl.innerText = `Вы финишировали ${position}-м из ${cars.length}`;
      if (rewardEl) rewardEl.innerText = `Награда: 🪙 ${reward} + ${currentCoinsCollected} монет`;
      if (resMenu) resMenu.style.display = "flex";
    }, 500);
  }

  const offBtn = document.getElementById("offline-btn");
  const onlBtn = document.getElementById("online-btn");
  const menuBtn = document.getElementById("menu-btn");

  if (offBtn) offBtn.addEventListener("click", startGame);
  if (onlBtn) onlBtn.addEventListener("click", startGame);
  if (menuBtn) menuBtn.addEventListener("click", () => {
    gameState = "menu";
    const resMenu = document.getElementById("result-menu");
    const mainMenu = document.getElementById("main-menu");
    if (resMenu) resMenu.style.display = "none";
    if (mainMenu) mainMenu.style.display = "flex";
  });

  function animate() {
    requestAnimationFrame(animate);

    if (gameState === "playing") {
      cars.forEach(car => car.update());
      checkCoinCollisions();
      updateHUD();
      updateCamera();
    } else {
      const time = Date.now() * 0.0003;
      camera.position.x = Math.sin(time) * 60;
      camera.position.z = Math.cos(time) * 60;
      camera.position.y = 30;
      camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
  }

  animate();
});
