/*
  Muda - Versao com invencibilidade v5

  Teste local:
  - Esta versao continua pronta para abrir direto pelo index.html.
  - Se o navegador bloquear PNGs ou audios no protocolo file://, use Live Server.

  Rollback:
  - As versoes anteriores continuam preservadas em game.js, game_v2_backup.js, game_v3.js e game_v4_balanced.js.
  - Esta iteracao de invencibilidade foi salva separadamente em game_v5_invincibility.js.
*/

(() => {
  const GAME_VERSION = "v5_invincibility";
  const INVINCIBILITY_DURATION = 2400;
  const TOTAL_PHASES = 7;
  const POWERUP_SPAWN_MARKERS = [0.22, 0.55, 0.82];
  const LOCAL_STORAGE_KEY = "muda-best-score";
  const RAINBOW_COLORS = [0xff365f, 0xff9447, 0xffd84a, 0x67d44f, 0x1da6ff, 0x5e62ff, 0xd652ff];

  const PHASES = Array.from({ length: TOTAL_PHASES }, (_, index) => {
    const phaseNumber = index + 1;
    const speedFactor = Number(Math.pow(1.12, index).toFixed(4));

    return {
      number: phaseNumber,
      duration: 30 + (index * 10),
      speedFactor,
      obstacleSpeed: Math.round(150 * speedFactor),
      spawnDelay: Math.max(1280, Math.round(2350 / Math.pow(1.06, index))),
      gapRatio: Math.max(0.29, 0.44 - (index * 0.02)),
      powerUpSpeed: Math.round(120 * speedFactor),
      parallaxCloud: 12 * speedFactor,
      parallaxFar: 24 * speedFactor,
      parallaxNear: 56 * speedFactor,
      saturation: index / (TOTAL_PHASES - 1),
      audioKey: `music_phase_${phaseNumber}`,
      audioStyle: [
        "8-bits / chiptune",
        "8-bits expandido",
        "16-bits leve",
        "16-bits completo",
        "MIDI divertido",
        "Hibrido orquestral",
        "Instrumentos reais"
      ][index]
    };
  });

  const COLORS = {
    skyTopGray: 0x83878f,
    skyTopColor: 0x64c8ff,
    skyBottomGray: 0xc5c7ce,
    skyBottomColor: 0x9ee2ff,
    cityGray: 0x7d828a,
    cityColor: 0x2e85ff,
    rooftopGray: 0x666a70,
    rooftopColor: 0x1b56d8,
    groundGray: 0x595d66,
    groundColor: 0x3074e6,
    cloudGray: 0xdfdfe2,
    cloudColor: 0xf8fdff,
    panelGray: 0xe6e7eb,
    panelColor: 0xffffff,
    sparkleGray: 0xe6e6e6,
    sparkleColor: 0xffffff,
    pipeGreenGray: 0x8e8f93,
    pipeGreenColor: 0x84f31c,
    pipeRedGray: 0x8b8b8e,
    pipeRedColor: 0xff295f,
    roofGray: 0x8a7c77,
    roofColor: 0xfb7992,
    dogGray: 0x7f766e,
    dogColor: 0xe8b17e,
    powerGray: 0xe0e0e0,
    powerColor: 0xf9c433,
    uiGray: 0xe7e7e7,
    uiColor: 0xffffff
  };

  const CROPS = {
    /* Recortes baseados nos assets reais presentes na pasta */
    mudaFromPng: { x: 238, y: 186, width: 102, height: 62 },
    mudaFromJpg: { x: 236, y: 186, width: 104, height: 62 },
    hudCat: { x: 2, y: 65, width: 30, height: 30 },
    hudCatAlt: { x: 34, y: 65, width: 30, height: 30 },
    powerTreat: { x: 0, y: 0, width: 52, height: 32 },
    powerToy: { x: 52, y: 0, width: 52, height: 32 }
  };

  const sharedState = {
    bestScore: Number(window.localStorage.getItem(LOCAL_STORAGE_KEY) || 0)
  };

  function mixColor(grayHex, vividHex, factor) {
    const t = Phaser.Math.Clamp(factor, 0, 1);
    const gray = Phaser.Display.Color.IntegerToColor(grayHex);
    const vivid = Phaser.Display.Color.IntegerToColor(vividHex);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(gray, vivid, 100, Math.round(t * 100));
    return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
  }

  function getLayout(width, height) {
    return {
      width,
      height,
      centerX: width * 0.5,
      centerY: height * 0.5,
      floorHeight: Math.max(96, Math.round(height * 0.15)),
      playerStartX: Math.round(width * 0.24)
    };
  }

  class AssetBuilder {
    static cropTexture(scene, sourceKey, targetKey, crop) {
      if (!scene.textures.exists(sourceKey) || scene.textures.exists(targetKey)) {
        return false;
      }

      const sourceImage = scene.textures.get(sourceKey).getSourceImage();
      const canvasTexture = scene.textures.createCanvas(targetKey, crop.width, crop.height);
      const context = canvasTexture.context;

      context.clearRect(0, 0, crop.width, crop.height);
      context.drawImage(
        sourceImage,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );
      canvasTexture.refresh();
      return true;
    }

    static cropTextureWithChroma(scene, sourceKey, targetKey, crop, chroma) {
      if (!scene.textures.exists(sourceKey) || scene.textures.exists(targetKey)) {
        return false;
      }

      const sourceImage = scene.textures.get(sourceKey).getSourceImage();
      const canvasTexture = scene.textures.createCanvas(targetKey, crop.width, crop.height);
      const context = canvasTexture.context;

      context.clearRect(0, 0, crop.width, crop.height);
      context.drawImage(
        sourceImage,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      const imageData = context.getImageData(0, 0, crop.width, crop.height);
      const data = imageData.data;
      let opaquePixels = 0;

      for (let index = 0; index < data.length; index += 4) {
        const dr = data[index] - chroma.r;
        const dg = data[index + 1] - chroma.g;
        const db = data[index + 2] - chroma.b;
        const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

        if (distance < chroma.tolerance) {
          data[index + 3] = 0;
        } else if (data[index + 3] > 0) {
          opaquePixels += 1;
        }
      }

      context.putImageData(imageData, 0, 0);
      canvasTexture.refresh();

      if (opaquePixels < 260) {
        scene.textures.remove(targetKey);
        return false;
      }

      return true;
    }

    static generateTexture(scene, key, width, height, drawCallback) {
      if (scene.textures.exists(key)) {
        return;
      }

      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      drawCallback(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    }

    static createFallbackTextures(scene) {
      this.generateTexture(scene, "muda-player", 96, 58, (g) => {
        g.fillStyle(0x2b2b2b, 1);
        g.fillRoundedRect(16, 18, 50, 24, 10);
        g.fillRoundedRect(48, 14, 24, 22, 8);
        g.fillStyle(0xf0e9dd, 1);
        g.fillRoundedRect(18, 20, 42, 18, 8);
        g.fillStyle(0x987962, 1);
        g.fillRoundedRect(52, 18, 14, 13, 4);
        g.fillTriangle(54, 15, 59, 4, 63, 15);
        g.fillTriangle(62, 15, 67, 4, 72, 15);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(58, 25, 2.5);
        g.fillRect(11, 23, 12, 6);
        g.fillStyle(0x111111, 1);
        g.lineStyle(3, 0x111111, 1);
        g.strokeRoundedRect(18, 20, 42, 18, 8);
      });

      this.generateTexture(scene, "hud-cat-icon", 28, 28, (g) => {
        g.fillStyle(0xf3efe8, 1);
        g.fillRoundedRect(5, 10, 14, 10, 4);
        g.fillStyle(0x987962, 1);
        g.fillRoundedRect(14, 8, 9, 8, 4);
        g.fillTriangle(14, 8, 17, 3, 19, 8);
        g.fillTriangle(20, 8, 23, 3, 25, 8);
      });

      this.generateTexture(scene, "power-treat", 44, 28, (g) => {
        g.fillStyle(0xffc940, 1);
        g.fillRoundedRect(3, 6, 38, 16, 8);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(14, 11, 4);
      });

      this.generateTexture(scene, "power-toy", 36, 36, (g) => {
        g.fillStyle(0xf472b6, 1);
        g.fillCircle(18, 18, 12);
        g.fillStyle(0xffffff, 0.65);
        g.fillCircle(12, 12, 3);
      });

      this.generateTexture(scene, "cloud-soft", 128, 72, (g) => {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(34, 40, 20);
        g.fillCircle(58, 28, 24);
        g.fillCircle(86, 38, 22);
        g.fillCircle(106, 46, 16);
        g.fillRoundedRect(20, 38, 92, 20, 10);
      });

      this.generateTexture(scene, "pipe-green", 72, 160, (g) => {
        g.fillStyle(0x84f31c, 1);
        g.fillRect(10, 12, 52, 136);
        g.fillStyle(0x5ebc16, 1);
        g.fillRect(10, 12, 10, 136);
        g.fillStyle(0xbffd6f, 1);
        g.fillRect(29, 12, 8, 136);
        g.fillStyle(0x6bd218, 1);
        g.fillRect(0, 0, 72, 22);
        g.fillRect(0, 138, 72, 22);
        g.lineStyle(4, 0x111111, 1);
        g.strokeRect(10, 12, 52, 136);
        g.strokeRect(0, 0, 72, 22);
        g.strokeRect(0, 138, 72, 22);
        g.lineStyle(2, 0xffffff, 0.38);
        g.lineBetween(30, 14, 30, 146);
        g.lineBetween(36, 14, 36, 146);
      });

      this.generateTexture(scene, "pipe-red", 72, 160, (g) => {
        g.fillStyle(0xff295f, 1);
        g.fillRect(10, 12, 52, 136);
        g.fillStyle(0xc41440, 1);
        g.fillRect(10, 12, 10, 136);
        g.fillStyle(0xff7ca0, 1);
        g.fillRect(29, 12, 8, 136);
        g.fillStyle(0xe51e53, 1);
        g.fillRect(0, 0, 72, 22);
        g.fillRect(0, 138, 72, 22);
        g.lineStyle(4, 0x111111, 1);
        g.strokeRect(10, 12, 52, 136);
        g.strokeRect(0, 0, 72, 22);
        g.strokeRect(0, 138, 72, 22);
        g.lineStyle(2, 0xffffff, 0.32);
        g.lineBetween(30, 14, 30, 146);
        g.lineBetween(36, 14, 36, 146);
      });

      this.generateTexture(scene, "roof-body", 72, 160, (g) => {
        g.fillStyle(0xfb7992, 1);
        g.fillRect(10, 18, 52, 132);
        g.fillStyle(0x88512b, 1);
        g.fillRect(0, 0, 72, 24);
        g.lineStyle(2, 0xfbcfe8, 1);
        for (let y = 4; y < 24; y += 6) {
          g.lineBetween(0, y, 72, y);
        }
      });

      this.generateTexture(scene, "dog-body", 76, 108, (g) => {
        g.fillStyle(0xe7b07d, 1);
        g.fillRoundedRect(12, 34, 48, 28, 12);
        g.fillRoundedRect(42, 20, 18, 18, 8);
        g.fillTriangle(42, 20, 48, 7, 52, 20);
        g.fillTriangle(52, 20, 58, 7, 62, 20);
        g.fillStyle(0x7e5d46, 1);
        g.fillRoundedRect(14, 40, 18, 16, 8);
        g.fillStyle(0x111827, 1);
        g.fillCircle(51, 29, 2.3);
      });
    }

    static ensureRuntimeTextures(scene) {
      let playerReady = false;

      if (scene.textures.exists("muda-source-png")) {
        playerReady = this.cropTextureWithChroma(
          scene,
          "muda-source-png",
          "muda-player",
          CROPS.mudaFromPng,
          { r: 72, g: 175, b: 239, tolerance: 90 }
        );
      }

      if (!playerReady && scene.textures.exists("muda-source-jpg")) {
        playerReady = this.cropTextureWithChroma(
          scene,
          "muda-source-jpg",
          "muda-player",
          CROPS.mudaFromJpg,
          { r: 177, g: 177, b: 177, tolerance: 28 }
        );
      }

      if (scene.textures.exists("ui-source")) {
        this.cropTexture(scene, "ui-source", "hud-cat-icon", CROPS.hudCat);
        this.cropTexture(scene, "ui-source", "hud-cat-icon-alt", CROPS.hudCatAlt);
      }

      if (scene.textures.exists("power-source")) {
        this.cropTexture(scene, "power-source", "power-treat", CROPS.powerTreat);
        this.cropTexture(scene, "power-source", "power-toy", CROPS.powerToy);
      }

      this.createFallbackTextures(scene);
    }
  }

  class HUDController {
    constructor(scene) {
      this.scene = scene;
      this.root = scene.add.container(0, 0).setDepth(80);
      this.lastLivesCount = -1;
      this.damageFlashActive = false;

      this.phaseText = this.createText("", 22, "#ffffff", "bold");
      this.timeText = this.createText("", 18, "#ffffff");
      this.scoreIcon = scene.add.image(0, 0, "power-treat").setOrigin(0, 0.5);
      this.scoreText = this.createText("", 18, "#ffffff", "bold");
      this.audioText = this.createText("", 14, "#dbeafe");
      this.lifeTitle = this.createText("Tolerancia", 16, "#ffffff", "bold");
      this.lifeIcons = [];

      this.root.add([
        this.phaseText,
        this.timeText,
        this.scoreIcon,
        this.scoreText,
        this.audioText,
        this.lifeTitle
      ]);
    }

    createText(value, size, color, weight = "normal") {
      const text = this.scene.add.text(0, 0, value, {
        fontFamily: "Courier New, monospace",
        fontSize: `${size}px`,
        color,
        fontStyle: weight
      });
      text.setShadow(2, 2, "#0f172a", 4, true, true);
      return text;
    }

    layout(bounds) {
      this.root.setPosition(16, 14);
      this.phaseText.setPosition(0, 0);
      this.timeText.setPosition(0, 28);
      this.scoreIcon.setPosition(0, 62);
      this.scoreIcon.setDisplaySize(26, 16);
      this.scoreText.setPosition(34, 50);
      this.audioText.setPosition(0, 82);

      const rightX = Math.max(220, bounds.width - 160);
      this.lifeTitle.setPosition(rightX, 0);
      this.reflowLives(0, bounds.width);
    }

    reflowLives(count, width) {
      this.lifeIcons.forEach((icon) => icon.destroy());
      this.lifeIcons = [];

      const rightX = Math.max(220, width - 160);
      const maxIcons = Math.min(count, 6);

      for (let index = 0; index < maxIcons; index += 1) {
        const key = index % 2 === 0 && this.scene.textures.exists("hud-cat-icon-alt")
          ? "hud-cat-icon-alt"
          : "hud-cat-icon";
        const icon = this.scene.add.image(rightX + (index * 22), 34, key).setOrigin(0, 0.5);
        icon.setDisplaySize(20, 20);
        this.lifeIcons.push(icon);
        this.root.add(icon);
      }

      if (count > maxIcons) {
        const extra = this.createText(`+${count - maxIcons}`, 14, "#ffffff", "bold");
        extra.setPosition(rightX + (maxIcons * 22) + 2, 24);
        this.lifeIcons.push(extra);
        this.root.add(extra);
      }
    }

    update(data) {
      this.phaseText.setText(`Fase ${data.phase}`);
      this.timeText.setText(`Tempo: ${data.timeLeft.toFixed(1)}s`);
      this.scoreText.setText(`Pontos: ${data.score}`);
      this.audioText.setText(data.audioLabel);
      this.scoreIcon.setTint(data.iconTint);

      if (this.lastLivesCount !== data.extraLives) {
        this.reflowLives(data.extraLives, data.width);
        this.lastLivesCount = data.extraLives;
      }

      if (!this.damageFlashActive) {
        this.lifeTitle.setColor("#ffffff");
        this.lifeIcons.forEach((icon) => {
          if (icon.setTint) {
            icon.setTint(data.iconTint);
          }
        });
      }
    }

    flashDamage() {
      if (this.damageTween) {
        this.damageTween.stop();
      }

      this.damageFlashActive = true;
      this.lifeTitle.setColor("#ff6b6b");

      this.lifeIcons.forEach((icon) => {
        if (icon.setTint) {
          icon.setTint(0xff5b5b);
        }
      });

      this.damageTween = this.scene.tweens.add({
        targets: [this.lifeTitle, ...this.lifeIcons],
        alpha: 0.25,
        duration: 120,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.damageFlashActive = false;
          this.lifeTitle.setColor("#ffffff");
          this.lifeTitle.setAlpha(1);
          this.lifeIcons.forEach((icon) => {
            icon.setAlpha(1);
          });
        }
      });
    }
  }

  class ObstacleFactory {
    constructor(scene, group) {
      this.scene = scene;
      this.group = group;
      this.serial = 0;
      this.pipeColorToggle = 0;
    }

    spawn(type, config) {
      const { width, height, floorHeight } = this.scene.layout;
      const gapSize = Math.max(188, Math.round(height * config.gapRatio));
      const safeTop = 100;
      const safeBottom = height - floorHeight - 100;
      const minCenter = Math.round(safeTop + (gapSize * 0.5));
      const maxCenter = Math.round(safeBottom - (gapSize * 0.5));
      const previousCenter = this.scene.lastGapCenterY || Math.round((minCenter + maxCenter) * 0.5);
      const maxGapShift = Math.max(42, Math.round(height * 0.08));
      const limitedMin = Phaser.Math.Clamp(previousCenter - maxGapShift, minCenter, maxCenter);
      const limitedMax = Phaser.Math.Clamp(previousCenter + maxGapShift, minCenter, maxCenter);
      const centerY = Phaser.Math.Between(
        Math.min(limitedMin, limitedMax),
        Math.max(limitedMin, limitedMax)
      );
      const obstacleWidth = Phaser.Math.Clamp(Math.round(width * 0.14), 74, 118);
      const spawnX = width + obstacleWidth;
      const topHeight = Math.max(48, Math.round(centerY - (gapSize * 0.5)));
      const bottomHeight = Math.max(48, Math.round((height - floorHeight) - (centerY + (gapSize * 0.5))));
      this.scene.lastGapCenterY = centerY;

      const style = this.getStyle(type);
      const pieces = [
        this.createPiece({
          x: spawnX,
          y: topHeight,
          width: obstacleWidth,
          height: topHeight,
          originY: 1,
          speed: config.obstacleSpeed,
          texture: style.texture,
          grayColor: style.grayColor,
          baseColor: style.baseColor,
          obstacleType: type
        }),
        this.createPiece({
          x: spawnX,
          y: centerY + (gapSize * 0.5),
          width: obstacleWidth,
          height: bottomHeight,
          originY: 0,
          speed: config.obstacleSpeed,
          texture: style.texture,
          grayColor: style.grayColor,
          baseColor: style.baseColor,
          obstacleType: type
        })
      ];

      if (type === "dog") {
        pieces[0].angle = 180;
        pieces[1].angle = 0;
      }

      const set = {
        id: this.serial += 1,
        type,
        pieces,
        scored: false
      };

      pieces.forEach((piece) => piece.setData("obstacleSetId", set.id));
      return set;
    }

    getStyle(type) {
      if (type === "pipe") {
        this.pipeColorToggle += 1;
        const redPipe = this.pipeColorToggle % 2 === 0;
        return redPipe
          ? { texture: "pipe-red", grayColor: COLORS.pipeRedGray, baseColor: COLORS.pipeRedColor }
          : { texture: "pipe-green", grayColor: COLORS.pipeGreenGray, baseColor: COLORS.pipeGreenColor };
      }

      if (type === "roof") {
        return { texture: "roof-body", grayColor: COLORS.roofGray, baseColor: COLORS.roofColor };
      }

      return { texture: "dog-body", grayColor: COLORS.dogGray, baseColor: COLORS.dogColor };
    }

    createPiece(config) {
      const tint = mixColor(config.grayColor, config.baseColor, this.scene.worldSaturation);
      let piece;

      if (this.scene.textures.exists(config.texture)) {
        piece = this.group.create(config.x, config.y, config.texture);
        piece.setOrigin(0.5, config.originY);
        piece.setDisplaySize(config.width, config.height);
      } else {
        piece = this.scene.add.rectangle(config.x, config.y, config.width, config.height, tint, 1).setOrigin(0.5, config.originY);
        this.scene.physics.add.existing(piece);
        this.group.add(piece);
      }

      piece.setActive(true);
      piece.setVisible(true);
      piece.setDepth(34);
      piece.grayColor = config.grayColor;
      piece.baseColor = config.baseColor;
      piece.obstacleType = config.obstacleType;

      if (piece.setTint) {
        piece.setTint(tint);
      } else {
        piece.fillColor = tint;
      }

      piece.body.setAllowGravity(false);
      piece.body.moves = true;
      piece.body.setImmovable(true);
      piece.body.setVelocityX(-config.speed);
      piece.body.setSize(config.width * 0.9, config.height * 0.92, true);

      return piece;
    }
  }

  class BootScene extends Phaser.Scene {
    constructor() {
      super("BootScene");
      this.failedAssets = new Set();
    }

    preload() {
      this.cameras.main.setBackgroundColor("#05070d");

      const loadingText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, "Carregando Muda...", {
        fontFamily: "Courier New, monospace",
        fontSize: "24px",
        color: "#ffffff"
      }).setOrigin(0.5);

      this.load.on("loaderror", (file) => {
        this.failedAssets.add(file.key);
      });

      this.load.on("progress", (progress) => {
        loadingText.setText(`Carregando Muda... ${Math.round(progress * 100)}%`);
      });

      this.load.image("muda-source-jpg", "./muda.jpg");
      this.load.image("muda-source-png", "./muda.png");
      this.load.image("ui-source", "./free.png");
      this.load.image("power-source", "./RetroCatsFree.png");

      for (let phase = 1; phase <= TOTAL_PHASES; phase += 1) {
        this.load.audio(`music_phase_${phase}`, [
          `./audio/fase${phase}.ogg`,
          `./audio/fase${phase}.mp3`
        ]);
      }

      this.load.audio("sfx_flap", ["./audio/flap.ogg", "./audio/flap.mp3"]);
      this.load.audio("sfx_collect", ["./audio/collect.ogg", "./audio/collect.mp3"]);
      this.load.audio("sfx_hit", ["./audio/hit.ogg", "./audio/hit.mp3"]);
      this.load.audio("sfx_win", ["./audio/win.ogg", "./audio/win.mp3"]);
    }

    create() {
      AssetBuilder.ensureRuntimeTextures(this);
      this.registry.set("failedAssets", Array.from(this.failedAssets));
      this.registry.set("gameVersion", GAME_VERSION);
      this.scene.start("MenuScene");
    }
  }

  class MenuScene extends Phaser.Scene {
    constructor() {
      super("MenuScene");
    }

    create() {
      this.layout = getLayout(this.scale.width, this.scale.height);
      this.clouds = [];
      this.tailHistory = [];
      this.timeBase = 0;

      this.createBackdrop();
      this.createHero();
      this.createTitle();
      this.createPlayButton();

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
      });

      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    createBackdrop() {
      this.skyTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.6, 0x68d0ff).setOrigin(0);
      this.skyBottom = this.add.rectangle(0, this.scale.height * 0.6, this.scale.width, this.scale.height * 0.4, 0x3ea4ff).setOrigin(0);
      this.horizon = this.add.rectangle(0, this.scale.height * 0.72, this.scale.width, this.scale.height * 0.16, 0x2674ea).setOrigin(0);
      this.ground = this.add.rectangle(0, this.scale.height * 0.86, this.scale.width, this.scale.height * 0.14, 0x1d61d8).setOrigin(0);

      for (let index = 0; index < 8; index += 1) {
        const cloud = this.add.image(0, 0, "cloud-soft").setAlpha(0.88);
        cloud.speed = Phaser.Math.FloatBetween(10, 24);
        cloud.depth = 3;
        this.clouds.push(cloud);
      }

      this.skyline = [];
      for (let index = 0; index < 7; index += 1) {
        const column = this.add.rectangle(0, 0, 60, Phaser.Math.Between(60, 160), 0x2273f2, 1).setOrigin(0.5, 1);
        column.setStrokeStyle(3, 0x17389f, 0.9);
        this.skyline.push(column);
      }
    }

    createHero() {
      this.rainbowGraphics = this.add.graphics().setDepth(18);
      this.hero = this.add.image(this.layout.centerX, this.layout.centerY + 16, "muda-player").setDepth(24);
      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.18, 112, 180);
      this.hero.setScale(targetWidth / this.hero.width);
      this.hero.angle = -3;

      this.tweens.add({
        targets: this.hero,
        y: this.hero.y + 14,
        angle: 5,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }

    createTitle() {
      this.title = this.add.text(this.layout.centerX, 90, "MUDA", {
        fontFamily: "Courier New, monospace",
        fontSize: `${Math.max(44, this.layout.width * 0.09)}px`,
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#17389f",
        strokeThickness: 10
      }).setOrigin(0.5);
      this.title.setShadow(0, 6, "#ffd54f", 0, false, true);

      this.subtitle = this.add.text(
        this.layout.centerX,
        162,
        "A gatinha siamesa e seu arco-iris em 7 fases.\nToque para voar e devolver as cores ao mundo.",
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: `${Math.max(16, this.layout.width * 0.03)}px`,
          color: "#effbff",
          align: "center",
          lineSpacing: 6,
          wordWrap: { width: Math.min(520, this.layout.width - 40) }
        }
      ).setOrigin(0.5);
      this.subtitle.setShadow(0, 2, "#0f172a", 4, true, true);
    }

    createPlayButton() {
      this.playButton = this.add.container(0, 0).setDepth(30);
      this.playButtonBg = this.add.rectangle(0, 0, 260, 72, 0xffef9e).setStrokeStyle(4, 0x9a5a16, 1);
      this.playButtonIcon = this.add.image(-82, 0, "hud-cat-icon").setDisplaySize(32, 32);
      this.playButtonToy = this.add.image(82, 0, "power-toy").setDisplaySize(30, 30);
      this.playButtonLabel = this.add.text(0, 0, "JOGAR", {
        fontFamily: "Courier New, monospace",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#1f2937"
      }).setOrigin(0.5);

      this.playButton.add([
        this.playButtonBg,
        this.playButtonIcon,
        this.playButtonToy,
        this.playButtonLabel
      ]);

      this.playButton.setSize(260, 72);
      this.playButton.setInteractive({ useHandCursor: true });
      this.playButton.on("pointerdown", () => this.startGame());
      this.playButton.on("pointerover", () => {
        this.tweens.add({
          targets: this.playButton,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 120,
          ease: "Sine.easeOut"
        });
      });
      this.playButton.on("pointerout", () => {
        this.tweens.add({
          targets: this.playButton,
          scaleX: 1,
          scaleY: 1,
          duration: 120,
          ease: "Sine.easeOut"
        });
      });

      this.footer = this.add.text(
        this.layout.centerX,
        this.layout.height - 44,
        "Versao visual: game_v3.js | Rollback anterior preservado",
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "13px",
          color: "#dbeafe"
        }
      ).setOrigin(0.5);
      this.footer.setShadow(0, 2, "#0f172a", 4, true, true);

      this.input.keyboard.once("keydown-SPACE", () => this.startGame());
      this.input.keyboard.once("keydown-UP", () => this.startGame());
    }

    startGame() {
      this.scene.start("GameScene", { phaseIndex: 0, score: 0, extraLives: 0 });
    }

    handleResize(gameSize) {
      this.layout = getLayout(gameSize.width, gameSize.height);
      this.skyTop.setSize(gameSize.width, gameSize.height * 0.6);
      this.skyBottom.setPosition(0, gameSize.height * 0.6).setSize(gameSize.width, gameSize.height * 0.4);
      this.horizon.setPosition(0, gameSize.height * 0.72).setSize(gameSize.width, gameSize.height * 0.16);
      this.ground.setPosition(0, gameSize.height * 0.86).setSize(gameSize.width, gameSize.height * 0.14);

      this.title.setPosition(this.layout.centerX, 94);
      this.subtitle.setPosition(this.layout.centerX, 168);
      this.hero.setPosition(this.layout.centerX, this.layout.centerY + 18);
      this.playButton.setPosition(this.layout.centerX, this.layout.height - 160);
      this.footer.setPosition(this.layout.centerX, this.layout.height - 38);

      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.18, 112, 180);
      this.hero.setScale(targetWidth / this.hero.width);

      this.clouds.forEach((cloud, index) => {
        cloud.x = (gameSize.width / this.clouds.length) * index + Phaser.Math.Between(20, 100);
        cloud.y = 70 + ((index % 3) * 62);
        cloud.setDisplaySize(Phaser.Math.Between(90, 150), Phaser.Math.Between(48, 72));
      });

      this.skyline.forEach((column, index) => {
        column.x = (gameSize.width / this.skyline.length) * index + (gameSize.width / this.skyline.length) * 0.5;
        column.y = gameSize.height - Math.round(gameSize.height * 0.14);
      });
    }

    update(time, delta) {
      const deltaSeconds = delta / 1000;
      this.timeBase = time;

      this.clouds.forEach((cloud) => {
        cloud.x -= cloud.speed * deltaSeconds;
        if (cloud.x < -cloud.displayWidth * 0.5 - 10) {
          cloud.x = this.layout.width + cloud.displayWidth * 0.5 + Phaser.Math.Between(20, 120);
        }
      });

      this.skyline.forEach((column, index) => {
        column.y = this.layout.height - Math.round(this.layout.height * 0.14);
        column.height = 70 + ((index % 4) * 30);
      });

      this.drawRainbowTrail(this.hero.x, this.hero.y, time, 1);
    }

    drawRainbowTrail(heroX, heroY, time, alpha) {
      this.tailHistory.unshift({
        x: heroX - (this.hero.displayWidth * 0.36),
        y: heroY + 4
      });

      if (this.tailHistory.length > 22) {
        this.tailHistory.length = 22;
      }

      this.rainbowGraphics.clear();

      for (let stripe = 0; stripe < RAINBOW_COLORS.length; stripe += 1) {
        this.rainbowGraphics.lineStyle(7, RAINBOW_COLORS[stripe], alpha);
        this.rainbowGraphics.beginPath();

        this.tailHistory.forEach((point, index) => {
          const wave = Math.sin((index * 0.42) + (time * 0.006)) * 3;
          const x = point.x - (index * 8.6);
          const y = point.y + ((stripe - 3) * 4) + wave;

          if (index === 0) {
            this.rainbowGraphics.moveTo(x, y);
          } else {
            this.rainbowGraphics.lineTo(x, y);
          }
        });

        this.rainbowGraphics.strokePath();
      }
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() {
      super("GameScene");
    }

    init(data) {
      this.phaseIndex = data.phaseIndex || 0;
      this.score = data.score || 0;
      this.extraLives = data.extraLives || 0;
    }

    create() {
      this.layout = getLayout(this.scale.width, this.scale.height);
      this.currentPhaseConfig = PHASES[this.phaseIndex];
      this.worldSaturation = this.currentPhaseConfig.saturation;
      this.phaseElapsedMs = 0;
      this.phaseTransitionActive = false;
      this.gameFinished = false;
      this.isInvincible = false;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;
      this.phasePowerUpTimers = [];
      this.obstacleSets = [];
      this.currentMusic = null;
      this.worldTintStamp = -1;
      this.rainbowTrail = [];
      this.lastGapCenterY = null;
      this.invincibilityTimer = null;
      this.invincibilityTween = null;

      this.physics.world.gravity.y = 680;
      this.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);

      this.createBackground();
      this.createGroups();
      this.createPlayer();
      this.createHud();
      this.createInput();

      this.obstacleFactory = new ObstacleFactory(this, this.obstacles);

      this.physics.add.overlap(this.player, this.obstacles, this.onPlayerHit, null, this);
      this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
        this.input.off("pointerdown", this.flap, this);
        this.input.keyboard.off("keydown-SPACE", this.flap, this);
        this.input.keyboard.off("keydown-UP", this.flap, this);
        this.clearInvincibilityState();
        this.stopCurrentMusic();
      });

      this.startPhase(this.phaseIndex);
      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    createBackground() {
      this.skyTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.58, COLORS.skyTopGray).setOrigin(0);
      this.skyBottom = this.add.rectangle(0, this.scale.height * 0.58, this.scale.width, this.scale.height * 0.28, COLORS.skyBottomGray).setOrigin(0);
      this.horizonBand = this.add.rectangle(0, this.scale.height * 0.72, this.scale.width, this.scale.height * 0.14, COLORS.cityGray).setOrigin(0);
      this.ground = this.add.rectangle(0, this.scale.height - this.layout.floorHeight, this.scale.width, this.layout.floorHeight, COLORS.groundGray).setOrigin(0);

      this.clouds = [];
      for (let index = 0; index < 7; index += 1) {
        const cloud = this.add.image(0, 0, "cloud-soft").setAlpha(0.78).setDepth(8);
        cloud.grayColor = COLORS.cloudGray;
        cloud.baseColor = COLORS.cloudColor;
        cloud.speedFactor = Phaser.Math.FloatBetween(0.9, 1.35);
        this.clouds.push(cloud);
      }

      this.cityBlocks = [];
      for (let index = 0; index < 8; index += 1) {
        const block = this.add.rectangle(0, 0, 80, 120, COLORS.cityGray, 1).setOrigin(0.5, 1).setDepth(10);
        block.grayColor = COLORS.cityGray;
        block.baseColor = COLORS.cityColor;
        block.strokeColor = COLORS.rooftopColor;
        block.setStrokeStyle(3, COLORS.rooftopGray, 0.9);
        this.cityBlocks.push(block);
      }

      this.parapets = [];
      for (let index = 0; index < 6; index += 1) {
        const parapet = this.add.rectangle(0, 0, 72, 110, COLORS.groundGray, 1).setOrigin(0.5, 1).setDepth(14);
        parapet.grayColor = COLORS.rooftopGray;
        parapet.baseColor = COLORS.rooftopColor;
        parapet.setStrokeStyle(3, 0x183797, 0.95);
        this.parapets.push(parapet);
      }

      this.sparkles = [];
      for (let index = 0; index < 12; index += 1) {
        const sparkle = this.add.star(0, 0, 4, 2, 7, COLORS.sparkleGray, 0.6).setDepth(16);
        sparkle.grayColor = COLORS.sparkleGray;
        sparkle.baseColor = COLORS.sparkleColor;
        sparkle.twinkleOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
        sparkle.speedFactor = Phaser.Math.FloatBetween(0.8, 1.3);
        this.sparkles.push(sparkle);
      }

      this.rainbowGraphics = this.add.graphics().setDepth(24);
      this.phaseBanner = this.add.text(0, 0, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#fff7cf",
        stroke: "#17389f",
        strokeThickness: 8,
        align: "center"
      }).setOrigin(0.5).setDepth(90).setAlpha(0);
      this.phaseBanner.setShadow(0, 2, "#0f172a", 6, true, true);
    }

    createGroups() {
      this.obstacles = this.physics.add.group({
        allowGravity: false,
        immovable: true
      });

      this.powerUps = this.physics.add.group({
        allowGravity: false,
        immovable: true
      });
    }

    createPlayer() {
      this.player = this.physics.add.sprite(this.layout.playerStartX, this.layout.centerY, "muda-player");
      this.player.setDepth(30);
      this.player.setCollideWorldBounds(false);
      this.player.body.setAllowGravity(true);
      this.player.body.setMaxVelocity(9999, 470);

      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.1, 74, 110);
      this.player.setScale(targetWidth / this.player.width);

      /* A hitbox fica menor que o visual para permitir raspar nos canos sem morte injusta. */
      this.player.body.setSize(this.player.displayWidth * 0.46, this.player.displayHeight * 0.50, true);
      this.player.body.setOffset(this.player.displayWidth * 0.28, this.player.displayHeight * 0.28);
    }

    createHud() {
      this.hud = new HUDController(this);
      this.hud.layout(this.layout);
    }

    createInput() {
      this.input.on("pointerdown", this.flap, this);
      this.input.keyboard.on("keydown-SPACE", this.flap, this);
      this.input.keyboard.on("keydown-UP", this.flap, this);
    }

    flap() {
      if (this.phaseTransitionActive || this.gameFinished || !this.player.body) {
        return;
      }

      this.player.setVelocityY(-Math.round(Math.max(250, this.layout.height * 0.31)));

      if (this.cache.audio.exists("sfx_flap")) {
        this.sound.play("sfx_flap", { volume: 0.28 });
      }
    }

    startPhase(index) {
      this.clearInvincibilityState();
      this.phaseIndex = index;
      this.currentPhaseConfig = PHASES[this.phaseIndex];
      this.phaseStartTime = this.time.now;
      this.phaseElapsedMs = 0;
      this.phaseTransitionActive = false;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;
      this.lastGapCenterY = null;

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

      this.tweenWorldSaturation(this.currentPhaseConfig.saturation);

      this.time.delayedCall(650, () => {
        if (!this.phaseTransitionActive && !this.gameFinished) {
          this.spawnObstacleSet();
        }
      });

      this.obstacleTimer = this.time.addEvent({
        delay: this.currentPhaseConfig.spawnDelay,
        callback: this.spawnObstacleSet,
        callbackScope: this,
        loop: true
      });

      POWERUP_SPAWN_MARKERS.forEach((marker) => {
        const timer = this.time.delayedCall(this.currentPhaseConfig.duration * marker * 1000, () => {
          this.spawnPowerUp();
        });
        this.phasePowerUpTimers.push(timer);
      });

      this.updatePhaseBanner(`Fase ${this.currentPhaseConfig.number}`);
      this.syncMusic();
      this.refreshWorldColors(true);
    }

    tweenWorldSaturation(target) {
      if (this.worldTintTween) {
        this.worldTintTween.stop();
      }

      this.worldTintTween = this.tweens.addCounter({
        from: this.worldSaturation,
        to: target,
        duration: 900,
        ease: "Sine.easeInOut",
        onUpdate: (tween) => {
          this.worldSaturation = tween.getValue();
          this.refreshWorldColors();
        }
      });
    }

    spawnObstacleSet() {
      if (this.phaseTransitionActive || this.gameFinished) {
        return;
      }

      const minimumSpawnSpacing = Math.max(220, Math.round(this.layout.width * 0.34));
      const newestActiveSet = [...this.obstacleSets]
        .reverse()
        .find((set) => set.pieces.some((piece) => piece.active));

      if (newestActiveSet) {
        const latestX = Math.max(
          ...newestActiveSet.pieces
            .filter((piece) => piece.active)
            .map((piece) => piece.x + ((piece.displayWidth || piece.width) * 0.5))
        );

        if (latestX > this.layout.width - minimumSpawnSpacing) {
          return;
        }
      }

      const type = Phaser.Utils.Array.GetRandom(["pipe", "pipe", "roof", "dog"]);
      const set = this.obstacleFactory.spawn(type, this.currentPhaseConfig);
      this.obstacleSets.push(set);
    }

    spawnPowerUp() {
      if (this.phaseTransitionActive || this.gameFinished || this.powerUpsSpawnedThisPhase >= 3) {
        return;
      }

      const key = this.powerUpsSpawnedThisPhase % 2 === 0 ? "power-treat" : "power-toy";
      const spawnX = this.layout.width + 70;
      const minY = 120;
      const maxY = this.layout.height - this.layout.floorHeight - 130;
      const y = Phaser.Math.Between(minY, maxY);
      let powerUp;

      if (this.textures.exists(key)) {
        powerUp = this.powerUps.create(spawnX, y, key);
        if (key === "power-treat") {
          powerUp.setDisplaySize(44, 26);
        } else {
          powerUp.setDisplaySize(34, 34);
        }
      } else {
        powerUp = this.add.rectangle(spawnX, y, 36, 36, COLORS.powerColor, 1);
        this.physics.add.existing(powerUp);
        this.powerUps.add(powerUp);
      }

      powerUp.setDepth(38);
      powerUp.baseColor = COLORS.powerColor;
      powerUp.grayColor = COLORS.powerGray;
      powerUp.spawnY = y;
      powerUp.floatSeed = Phaser.Math.FloatBetween(0, Math.PI * 2);

      if (powerUp.setTint) {
        powerUp.setTint(mixColor(COLORS.powerGray, COLORS.powerColor, this.worldSaturation));
      } else {
        powerUp.fillColor = mixColor(COLORS.powerGray, COLORS.powerColor, this.worldSaturation);
      }

      powerUp.body.setAllowGravity(false);
      powerUp.body.moves = true;
      powerUp.body.setVelocityX(-this.currentPhaseConfig.powerUpSpeed);
      powerUp.body.setSize(powerUp.displayWidth * 0.82, powerUp.displayHeight * 0.82, true);

      this.powerUpsSpawnedThisPhase += 1;
    }

    collectPowerUp(player, powerUp) {
      if (!powerUp.active) {
        return;
      }

      powerUp.destroy();
      this.extraLives += 1;
      this.powerUpsCollectedThisPhase += 1;
      this.score += 3;

      if (this.cache.audio.exists("sfx_collect")) {
        this.sound.play("sfx_collect", { volume: 0.34 });
      }

      this.cameras.main.flash(110, 255, 255, 255, false);
      this.cameras.main.shake(120, 0.0025, true);

      this.tweens.add({
        targets: this.player,
        scaleX: this.player.scaleX * 1.08,
        scaleY: this.player.scaleY * 1.08,
        duration: 120,
        yoyo: true
      });
    }

    activateInvincibility() {
      this.clearInvincibilityState(false);
      this.isInvincible = true;

      this.invincibilityTween = this.tweens.add({
        targets: [this.player, this.rainbowGraphics],
        alpha: 0.2,
        duration: 150,
        yoyo: true,
        repeat: -1
      });

      this.invincibilityTimer = this.time.delayedCall(INVINCIBILITY_DURATION, () => {
        this.clearInvincibilityState();
      });
    }

    clearInvincibilityState(restoreVisuals = true) {
      this.isInvincible = false;

      if (this.invincibilityTimer) {
        this.invincibilityTimer.remove(false);
        this.invincibilityTimer = null;
      }

      if (this.invincibilityTween) {
        this.invincibilityTween.stop();
        this.invincibilityTween = null;
      }

      if (restoreVisuals) {
        if (this.player) {
          this.player.setAlpha(1);
        }
        if (this.rainbowGraphics) {
          this.rainbowGraphics.setAlpha(1);
        }
      }
    }

    onPlayerHit() {
      if (this.phaseTransitionActive || this.isInvincible || this.gameFinished) {
        return;
      }

      if (this.extraLives > 0) {
        this.extraLives -= 1;
        this.hud.flashDamage();
        this.activateInvincibility();

        if (this.cache.audio.exists("sfx_hit")) {
          this.sound.play("sfx_hit", { volume: 0.34 });
        }
        return;
      }

      this.finishGame(false);
    }

    finishGame(victory) {
      if (this.gameFinished) {
        return;
      }

      this.gameFinished = true;
      this.phaseTransitionActive = true;
      this.clearInvincibilityState();
      this.stopCurrentMusic();

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));

      sharedState.bestScore = Math.max(sharedState.bestScore, this.score);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, String(sharedState.bestScore));

      if (victory) {
        if (this.cache.audio.exists("sfx_win")) {
          this.sound.play("sfx_win", { volume: 0.42 });
        }

        this.time.delayedCall(900, () => {
          this.scene.start("WinScene", { score: this.score, phase: this.currentPhaseConfig.number });
        });
        return;
      }

      this.time.delayedCall(650, () => {
        this.scene.start("GameOverScene", { score: this.score, phase: this.currentPhaseConfig.number });
      });
    }

    completePhase() {
      if (this.phaseTransitionActive) {
        return;
      }

      this.phaseTransitionActive = true;
      this.score += 10;

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

      if (this.phaseIndex >= TOTAL_PHASES - 1) {
        this.worldSaturation = 1;
        this.refreshWorldColors(true);
        this.finishGame(true);
        return;
      }

      this.updatePhaseBanner(
        `Fase ${this.currentPhaseConfig.number} concluida!\nVelocidade +15% e mais cor no cenario.`
      );

      this.time.delayedCall(1700, () => {
        this.startPhase(this.phaseIndex + 1);
      });
    }

    syncMusic() {
      this.stopCurrentMusic();

      if (!this.cache.audio.exists(this.currentPhaseConfig.audioKey)) {
        return;
      }

      this.currentMusic = this.sound.add(this.currentPhaseConfig.audioKey, {
        volume: 0.34,
        loop: true
      });
      this.currentMusic.play();
    }

    stopCurrentMusic() {
      if (this.currentMusic) {
        this.currentMusic.stop();
        this.currentMusic.destroy();
        this.currentMusic = null;
      }
    }

    updatePhaseBanner(message) {
      this.phaseBanner.setText(message);
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.32);
      this.tweens.killTweensOf(this.phaseBanner);
      this.phaseBanner.setAlpha(0);
      this.tweens.add({
        targets: this.phaseBanner,
        alpha: 1,
        duration: 260,
        yoyo: true,
        hold: 1000
      });
    }

    refreshWorldColors(force = false) {
      const stamp = Math.round(this.worldSaturation * 20);
      if (!force && stamp === this.worldTintStamp) {
        return;
      }

      this.worldTintStamp = stamp;

      this.skyTop.fillColor = mixColor(COLORS.skyTopGray, COLORS.skyTopColor, this.worldSaturation);
      this.skyBottom.fillColor = mixColor(COLORS.skyBottomGray, COLORS.skyBottomColor, this.worldSaturation);
      this.horizonBand.fillColor = mixColor(COLORS.cityGray, COLORS.cityColor, this.worldSaturation);
      this.ground.fillColor = mixColor(COLORS.groundGray, COLORS.groundColor, this.worldSaturation);

      this.clouds.forEach((cloud) => {
        cloud.setTint(mixColor(cloud.grayColor, cloud.baseColor, this.worldSaturation));
      });

      this.cityBlocks.forEach((block) => {
        block.fillColor = mixColor(block.grayColor, block.baseColor, this.worldSaturation);
        block.setStrokeStyle(3, mixColor(COLORS.rooftopGray, block.strokeColor, this.worldSaturation), 0.95);
      });

      this.parapets.forEach((parapet) => {
        parapet.fillColor = mixColor(parapet.grayColor, parapet.baseColor, this.worldSaturation);
      });

      this.sparkles.forEach((sparkle) => {
        sparkle.fillColor = mixColor(sparkle.grayColor, sparkle.baseColor, this.worldSaturation);
      });

      this.obstacles.children.each((obstacle) => {
        if (!obstacle.active) {
          return;
        }
        const tint = mixColor(obstacle.grayColor || 0xffffff, obstacle.baseColor || 0xffffff, this.worldSaturation);
        if (obstacle.setTint) {
          obstacle.setTint(tint);
        } else {
          obstacle.fillColor = tint;
        }
      });

      this.powerUps.children.each((powerUp) => {
        if (!powerUp.active) {
          return;
        }
        const tint = mixColor(powerUp.grayColor || 0xffffff, powerUp.baseColor || COLORS.powerColor, this.worldSaturation);
        if (powerUp.setTint) {
          powerUp.setTint(tint);
        } else {
          powerUp.fillColor = tint;
        }
      });
    }

    handleResize(gameSize) {
      this.layout = getLayout(gameSize.width, gameSize.height);
      this.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);

      this.skyTop.setSize(gameSize.width, gameSize.height * 0.58);
      this.skyBottom.setPosition(0, gameSize.height * 0.58).setSize(gameSize.width, gameSize.height * 0.28);
      this.horizonBand.setPosition(0, gameSize.height * 0.72).setSize(gameSize.width, gameSize.height * 0.14);
      this.ground.setPosition(0, gameSize.height - this.layout.floorHeight).setSize(gameSize.width, this.layout.floorHeight);

      this.clouds.forEach((cloud, index) => {
        if (cloud.x === 0) {
          cloud.x = (gameSize.width / this.clouds.length) * index + Phaser.Math.Between(10, 90);
        }
        cloud.y = 72 + ((index % 3) * 60);
        cloud.setDisplaySize(Phaser.Math.Between(96, 150), Phaser.Math.Between(48, 74));
      });

      this.cityBlocks.forEach((block, index) => {
        block.width = 48 + ((index % 4) * 18);
        block.height = 68 + ((index % 5) * 26);
        block.x = (gameSize.width / this.cityBlocks.length) * index + (gameSize.width / this.cityBlocks.length) * 0.5;
        block.y = gameSize.height - this.layout.floorHeight;
      });

      this.parapets.forEach((parapet, index) => {
        parapet.width = 56 + ((index % 3) * 26);
        parapet.height = 80 + ((index % 4) * 36);
        parapet.x = (gameSize.width / this.parapets.length) * index + (gameSize.width / this.parapets.length) * 0.5;
        parapet.y = gameSize.height - Math.round(this.layout.floorHeight * 0.9);
      });

      this.sparkles.forEach((sparkle) => {
        sparkle.baseX = Phaser.Math.Between(30, gameSize.width - 30);
        sparkle.baseY = Phaser.Math.Between(60, Math.max(90, gameSize.height * 0.6));
        sparkle.x = sparkle.baseX;
        sparkle.y = sparkle.baseY;
      });

      this.player.x = this.layout.playerStartX;
      this.player.y = Phaser.Math.Clamp(this.player.y || this.layout.centerY, 110, gameSize.height - this.layout.floorHeight - 84);

      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.1, 74, 110);
      this.player.setScale(targetWidth / this.player.width);
      this.player.body.setSize(this.player.displayWidth * 0.46, this.player.displayHeight * 0.50, true);
      this.player.body.setOffset(this.player.displayWidth * 0.28, this.player.displayHeight * 0.28);

      this.hud.layout(this.layout);
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.32);
    }

    update(time, delta) {
      if (!this.player || !this.player.body) {
        return;
      }

      if (!this.gameFinished) {
        this.phaseElapsedMs = time - this.phaseStartTime;
      }

      this.updateParallax(delta, time);
      this.updatePlayerVisuals();
      this.updateRainbowTrail(time);
      this.updateObstacles();
      this.updatePowerUps(time);
      this.updateHud();

      if (!this.phaseTransitionActive && !this.gameFinished) {
        const floorLimit = this.layout.height - this.layout.floorHeight - 8;

        if (this.player.y <= 22 || this.player.y >= floorLimit) {
          this.onPlayerHit();
        }

        if (this.phaseElapsedMs >= (this.currentPhaseConfig.duration * 1000)) {
          this.completePhase();
        }
      }
    }

    updateParallax(delta, time) {
      const deltaSeconds = delta / 1000;

      this.clouds.forEach((cloud) => {
        cloud.x -= this.currentPhaseConfig.parallaxCloud * cloud.speedFactor * deltaSeconds;
        if (cloud.x < -(cloud.displayWidth * 0.5) - 20) {
          cloud.x = this.layout.width + cloud.displayWidth * 0.5 + Phaser.Math.Between(20, 120);
        }
      });

      this.cityBlocks.forEach((block) => {
        block.x -= this.currentPhaseConfig.parallaxFar * deltaSeconds;
        if (block.x < -(block.width * 0.5) - 20) {
          block.x = this.layout.width + (block.width * 0.5) + Phaser.Math.Between(40, 120);
        }
        block.y = this.layout.height - this.layout.floorHeight;
      });

      this.parapets.forEach((parapet) => {
        parapet.x -= this.currentPhaseConfig.parallaxNear * deltaSeconds;
        if (parapet.x < -(parapet.width * 0.5) - 20) {
          parapet.x = this.layout.width + (parapet.width * 0.5) + Phaser.Math.Between(60, 140);
        }
        parapet.y = this.layout.height - Math.round(this.layout.floorHeight * 0.9);
      });

      this.sparkles.forEach((sparkle, index) => {
        sparkle.alpha = 0.2 + (0.5 * ((Math.sin((time * 0.003) + sparkle.twinkleOffset + index) + 1) * 0.5));
        sparkle.x -= this.currentPhaseConfig.parallaxFar * 0.22 * deltaSeconds * sparkle.speedFactor;
        sparkle.y = sparkle.baseY + (Math.sin((time * 0.0018) + sparkle.twinkleOffset) * 5);

        if (sparkle.x < -12) {
          sparkle.baseX = this.layout.width + Phaser.Math.Between(20, 140);
          sparkle.x = sparkle.baseX;
        }
      });
    }

    updatePlayerVisuals() {
      const angle = Phaser.Math.Clamp(this.player.body.velocity.y * 0.045, -18, 24);
      this.player.setAngle(angle);
    }

    updateRainbowTrail(time) {
      this.rainbowTrail.unshift({
        x: this.player.x - (this.player.displayWidth * 0.34),
        y: this.player.y + 2
      });

      if (this.rainbowTrail.length > 24) {
        this.rainbowTrail.length = 24;
      }

      this.rainbowGraphics.clear();

      for (let stripe = 0; stripe < RAINBOW_COLORS.length; stripe += 1) {
        this.rainbowGraphics.lineStyle(7, RAINBOW_COLORS[stripe], 1);
        this.rainbowGraphics.beginPath();

        this.rainbowTrail.forEach((point, index) => {
          const wave = Math.sin((index * 0.38) + (time * 0.006)) * 3.4;
          const x = point.x - (index * 8.8);
          const y = point.y + ((stripe - 3) * 4.1) + wave;

          if (index === 0) {
            this.rainbowGraphics.moveTo(x, y);
          } else {
            this.rainbowGraphics.lineTo(x, y);
          }
        });

        this.rainbowGraphics.strokePath();
      }
    }

    updateObstacles() {
      this.obstacleSets = this.obstacleSets.filter((set) => {
        set.pieces = set.pieces.filter((piece) => piece && piece.active);

        if (set.pieces.length === 0) {
          return false;
        }

        if (!set.scored) {
          const rightmost = Math.max(...set.pieces.map((piece) => piece.x + ((piece.displayWidth || piece.width) * 0.5)));
          if (rightmost < this.player.x - (this.player.displayWidth * 0.45)) {
            set.scored = true;
            this.score += 1;
          }
        }

        set.pieces.forEach((piece) => {
          if (piece.x < -((piece.displayWidth || piece.width) + 80)) {
            piece.destroy();
          }
        });

        return set.pieces.some((piece) => piece.active);
      });
    }

    updatePowerUps(time) {
      this.powerUps.children.each((powerUp) => {
        if (!powerUp.active) {
          return;
        }

        powerUp.y = powerUp.spawnY + (Math.sin((time * 0.0045) + powerUp.floatSeed) * 8);
        if (powerUp.body && powerUp.body.updateFromGameObject) {
          powerUp.body.updateFromGameObject();
        }

        if (powerUp.x < -80) {
          powerUp.destroy();
        }
      });
    }

    updateHud() {
      const phaseDurationMs = this.currentPhaseConfig.duration * 1000;
      const timeLeft = Math.max(0, (phaseDurationMs - this.phaseElapsedMs) / 1000);
      const iconTint = mixColor(COLORS.uiGray, COLORS.uiColor, this.worldSaturation);

      this.hud.update({
        phase: this.currentPhaseConfig.number,
        timeLeft,
        score: this.score,
        extraLives: this.extraLives,
        audioLabel: this.cache.audio.exists(this.currentPhaseConfig.audioKey)
          ? `Trilha: ${this.currentPhaseConfig.audioStyle}`
          : `Audio local: ${this.currentPhaseConfig.audioStyle}`,
        iconTint,
        width: this.layout.width
      });
    }
  }

  class GameOverScene extends Phaser.Scene {
    constructor() {
      super("GameOverScene");
    }

    create(data) {
      this.cameras.main.setBackgroundColor("#15306b");

      this.add.text(this.scale.width * 0.5, 120, "Game Over", {
        fontFamily: "Courier New, monospace",
        fontSize: "46px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#7c1830",
        strokeThickness: 8
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      this.add.text(this.scale.width * 0.5, 220, [
        `Voce chegou ate a Fase ${data.phase}.`,
        `Pontuacao final: ${data.score}.`,
        `Melhor pontuacao: ${sharedState.bestScore}.`
      ], {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "22px",
        color: "#e5f3ff",
        align: "center",
        lineSpacing: 12
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      const hero = this.add.image(this.scale.width * 0.5, 360, "muda-player").setAngle(-10);
      hero.setScale(2.7);

      const rainbow = this.add.graphics().setDepth(hero.depth - 1);
      for (let stripe = 0; stripe < RAINBOW_COLORS.length; stripe += 1) {
        rainbow.lineStyle(7, RAINBOW_COLORS[stripe], 1);
        rainbow.beginPath();
        rainbow.moveTo(hero.x - 24, hero.y + ((stripe - 3) * 4));
        rainbow.lineTo(hero.x - 170, hero.y + ((stripe - 3) * 4) + 6);
        rainbow.strokePath();
      }

      this.add.text(this.scale.width * 0.5, this.scale.height - 124, "Toque, clique ou pressione ESPACO para voltar ao menu.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fff4ae",
        align: "center"
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      this.input.once("pointerdown", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-UP", () => this.scene.start("MenuScene"));
    }
  }

  class WinScene extends Phaser.Scene {
    constructor() {
      super("WinScene");
    }

    create(data) {
      this.cameras.main.setBackgroundColor("#0f3d97");

      this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.64, 0x60cdff).setOrigin(0);
      this.add.rectangle(0, this.scale.height * 0.64, this.scale.width, this.scale.height * 0.36, 0x2468e1).setOrigin(0);

      this.add.text(this.scale.width * 0.5, 110, "VITORIA!", {
        fontFamily: "Courier New, monospace",
        fontSize: "50px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#17389f",
        strokeThickness: 10
      }).setOrigin(0.5).setShadow(0, 6, "#ffd54f", 0, false, true);

      this.add.text(this.scale.width * 0.5, 210, [
        "A Muda concluiu a Fase 7.",
        "O mundo voltou a ficar colorido.",
        "Seu miado de gatinho foi encontrado!"
      ], {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "24px",
        color: "#effbff",
        align: "center",
        lineSpacing: 12
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      const rainbow = this.add.graphics().setDepth(22);
      for (let stripe = 0; stripe < RAINBOW_COLORS.length; stripe += 1) {
        rainbow.lineStyle(8, RAINBOW_COLORS[stripe], 1);
        rainbow.beginPath();
        rainbow.moveTo((this.scale.width * 0.5) - 18, 360 + ((stripe - 3) * 4));
        rainbow.lineTo((this.scale.width * 0.5) - 210, 372 + ((stripe - 3) * 4));
        rainbow.strokePath();
      }

      const hero = this.add.image(this.scale.width * 0.5, 360, "muda-player").setDepth(30);
      hero.setScale(3.2);

      this.add.text(this.scale.width * 0.5, 500, `Pontuacao final: ${data.score}`, {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "26px",
        color: "#dbeafe"
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      this.add.text(this.scale.width * 0.5, this.scale.height - 122, "Toque, clique ou pressione ESPACO para voltar ao menu.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fff4ae",
        align: "center"
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      this.input.once("pointerdown", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-UP", () => this.scene.start("MenuScene"));
    }
  }

  const gameConfig = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0a1737",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 680 },
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, WinScene]
  };

  window.MudaGame = new Phaser.Game(gameConfig);
})();
