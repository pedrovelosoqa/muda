/*
  Muda - Versao base v1

  Teste local:
  - A estrutura funciona abrindo index.html.
  - Se imagens ou audios falharem no file:// por CORS, teste com a extensao Live Server.

  Rollback:
  - Este arquivo espelha a primeira base estavel em game_v1.js.
  - Em futuras iteracoes, preserve esta copia e gere novos snapshots (ex: game_v2.js)
    antes de alterar game.js.
*/

(() => {
  const GAME_VERSION = "v1";
  const TOTAL_PHASES = 7;
  const RAINBOW_COLORS = [0xff595e, 0xff924c, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff4fa3];
  const POWERUP_SPAWN_MARKERS = [0.22, 0.55, 0.82];
  const LOCAL_STORAGE_KEY = "muda-best-score";

  const PHASES = Array.from({ length: TOTAL_PHASES }, (_, index) => {
    const phaseNumber = index + 1;
    return {
      number: phaseNumber,
      duration: 30 + (index * 10),
      obstacleSpeed: 215 + (index * 18),
      spawnDelay: Math.max(980, 1880 - (index * 120)),
      gapRatio: Math.max(0.205, 0.34 - (index * 0.02)),
      powerUpDrift: 150 + (index * 10),
      worldColor: index / (TOTAL_PHASES - 1),
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

  const COLOR_PRESETS = {
    skyTop: 0x6d6f73,
    skyTopLive: 0x7dd3fc,
    skyBottom: 0x9ca3af,
    skyBottomLive: 0xdbeafe,
    horizon: 0x7c8695,
    horizonLive: 0x60a5fa,
    ground: 0x4b5563,
    groundLive: 0x2563eb,
    pipe: 0x7f8c8d,
    pipeLive: 0x82f11b,
    roof: 0x8f7b73,
    roofLive: 0xfb7185,
    dog: 0x7d7269,
    dogLive: 0xf4b183,
    panel: 0x111827,
    panelLive: 0x164e63,
    text: 0xe5e7eb,
    accent: 0xfbbf24,
    power: 0xfacc15,
    life: 0x93c5fd
  };

  const CROPS = {
    mudaPreview: { x: 238, y: 186, width: 100, height: 60 },
    uiPanel: { x: 0, y: 0, width: 256, height: 128 },
    powerTreat: { x: 0, y: 0, width: 32, height: 32 },
    powerTreatAlt: { x: 32, y: 0, width: 32, height: 32 }
  };

  const sharedState = {
    bestScore: Number(window.localStorage.getItem(LOCAL_STORAGE_KEY) || 0)
  };

  class RainbowTailPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
      super({
        game,
        fragShader: `
          precision mediump float;

          uniform sampler2D uMainSampler;
          varying vec2 outTexCoord;
          varying vec4 outTint;

          uniform float uSaturation;
          uniform float uRainbowProgress;
          uniform float uTime;

          vec3 toGray(vec3 color) {
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            return vec3(luma);
          }

          vec3 rainbowColor(float t) {
            if (t < 0.142857) return vec3(1.0, 0.35, 0.37);
            if (t < 0.285714) return vec3(1.0, 0.58, 0.30);
            if (t < 0.428571) return vec3(1.0, 0.79, 0.23);
            if (t < 0.571428) return vec3(0.54, 0.79, 0.15);
            if (t < 0.714285) return vec3(0.10, 0.51, 0.77);
            if (t < 0.857142) return vec3(0.42, 0.30, 0.58);
            return vec3(1.0, 0.31, 0.64);
          }

          void main() {
            vec4 tex = texture2D(uMainSampler, outTexCoord) * outTint;

            if (tex.a <= 0.01) {
              gl_FragColor = tex;
              return;
            }

            vec3 base = mix(toGray(tex.rgb), tex.rgb, clamp(uSaturation, 0.0, 1.0));
            float tailMask = smoothstep(0.42, 0.10, outTexCoord.x);
            float visibleBands = floor(clamp(uRainbowProgress, 0.0, 1.0) * 7.0 + 0.001);
            float bandIndex = floor((1.0 - outTexCoord.y) * 7.0);
            float unlocked = step(bandIndex, max(visibleBands - 1.0, -1.0));
            vec3 stripe = rainbowColor(clamp((bandIndex + 0.5) / 7.0, 0.0, 1.0));
            float pulse = 0.88 + (0.12 * sin((outTexCoord.y * 12.0) - (uTime * 0.007)));
            vec3 finalColor = mix(base, stripe * pulse, tailMask * unlocked * 0.88);

            gl_FragColor = vec4(finalColor, tex.a);
          }
        `
      });
    }
  }

  class AssetBuilder {
    static ensurePipeline(scene) {
      if (scene.game.renderer.type !== Phaser.WEBGL) {
        return;
      }

      if (!scene.game.renderer.pipelines.has("MudaRainbow")) {
        scene.game.renderer.pipelines.add("MudaRainbow", new RainbowTailPipeline(scene.game));
      }
    }

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

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - chroma.r;
        const dg = data[i + 1] - chroma.g;
        const db = data[i + 2] - chroma.b;
        const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

        if (distance < chroma.tolerance) {
          data[i + 3] = 0;
          continue;
        }

        if (data[i + 3] > 0) {
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
      this.generateTexture(scene, "muda-player", 80, 52, (g) => {
        g.fillStyle(0x4b3b34, 1);
        g.fillRoundedRect(16, 18, 42, 22, 8);
        g.fillRoundedRect(46, 16, 18, 20, 8);
        g.fillStyle(0xf0e9dd, 1);
        g.fillRoundedRect(18, 20, 36, 18, 8);
        g.fillStyle(0x9d755d, 1);
        g.fillRoundedRect(48, 19, 12, 12, 4);
        g.fillTriangle(50, 15, 54, 5, 58, 15);
        g.fillTriangle(58, 15, 62, 5, 66, 15);
        g.fillRect(10, 24, 12, 6);
        g.fillRect(5, 22, 8, 5);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(57, 25, 2.4);
      });

      this.generateTexture(scene, "power-treat", 36, 36, (g) => {
        g.fillStyle(0xfcd34d, 1);
        g.fillCircle(18, 18, 15);
        g.fillStyle(0xf59e0b, 1);
        g.fillCircle(18, 18, 9);
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(13, 13, 4);
      });

      this.generateTexture(scene, "power-treat-alt", 36, 36, (g) => {
        g.fillStyle(0xf472b6, 1);
        g.fillRoundedRect(8, 12, 20, 12, 4);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, 18, 4);
        g.fillCircle(28, 18, 4);
      });

      this.generateTexture(scene, "pipe-body", 64, 128, (g) => {
        g.fillStyle(0x82f11b, 1);
        g.fillRect(8, 8, 48, 120);
        g.fillStyle(0x54b50f, 1);
        g.fillRect(8, 8, 10, 120);
        g.fillStyle(0x9dff41, 1);
        g.fillRect(26, 8, 8, 120);
        g.fillStyle(0x6dc513, 1);
        g.fillRect(0, 0, 64, 18);
        g.fillRect(0, 110, 64, 18);
      });

      this.generateTexture(scene, "roof-body", 64, 128, (g) => {
        g.fillStyle(0xf78da7, 1);
        g.fillRect(8, 18, 48, 110);
        g.fillStyle(0x8b5e3c, 1);
        g.fillRect(0, 0, 64, 24);
        g.lineStyle(2, 0xfbcfe8, 1);
        for (let y = 4; y < 24; y += 6) {
          g.lineBetween(0, y, 64, y);
        }
      });

      this.generateTexture(scene, "dog-body", 64, 96, (g) => {
        g.fillStyle(0xf4b183, 1);
        g.fillRoundedRect(10, 28, 44, 28, 12);
        g.fillRoundedRect(36, 18, 18, 18, 7);
        g.fillTriangle(38, 18, 44, 6, 48, 18);
        g.fillTriangle(48, 18, 54, 6, 58, 18);
        g.fillStyle(0x7c5c45, 1);
        g.fillRoundedRect(12, 34, 16, 16, 8);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(46, 27, 2.4);
      });

      this.generateTexture(scene, "ui-cat-card", 44, 44, (g) => {
        g.fillStyle(0x111827, 0.85);
        g.fillRoundedRect(0, 0, 44, 44, 10);
        g.fillStyle(0xf5f3eb, 1);
        g.fillRoundedRect(8, 13, 22, 16, 6);
        g.fillStyle(0x9d755d, 1);
        g.fillRoundedRect(22, 11, 10, 10, 4);
        g.fillTriangle(22, 11, 25, 4, 28, 11);
        g.fillTriangle(29, 11, 32, 4, 35, 11);
      });
    }

    static ensureRuntimeTextures(scene) {
      let playerPrepared = false;

      if (scene.textures.exists("muda-source")) {
        playerPrepared = this.cropTextureWithChroma(
          scene,
          "muda-source",
          "muda-player",
          CROPS.mudaPreview,
          { r: 72, g: 175, b: 239, tolerance: 85 }
        );
      }

      if (scene.textures.exists("ui-source")) {
        this.cropTexture(scene, "ui-source", "ui-panel", CROPS.uiPanel);
      }

      if (scene.textures.exists("power-source")) {
        this.cropTexture(scene, "power-source", "power-treat", CROPS.powerTreat);
        this.cropTexture(scene, "power-source", "power-treat-alt", CROPS.powerTreatAlt);
      }

      this.createFallbackTextures(scene);

      if (!playerPrepared && scene.textures.exists("muda-source") && !scene.textures.exists("muda-player")) {
        this.generateTexture(scene, "muda-player", 80, 52, (g) => {
          g.fillStyle(0x4b3b34, 1);
          g.fillRoundedRect(16, 18, 42, 22, 8);
          g.fillRoundedRect(46, 16, 18, 20, 8);
          g.fillStyle(0xf0e9dd, 1);
          g.fillRoundedRect(18, 20, 36, 18, 8);
          g.fillStyle(0x9d755d, 1);
          g.fillRoundedRect(48, 19, 12, 12, 4);
          g.fillTriangle(50, 15, 54, 5, 58, 15);
          g.fillTriangle(58, 15, 62, 5, 66, 15);
          g.fillRect(10, 24, 12, 6);
          g.fillStyle(0x1f2937, 1);
          g.fillCircle(57, 25, 2.4);
        });
      }
    }
  }

  class HUDController {
    constructor(scene) {
      this.scene = scene;
      this.root = scene.add.container(0, 0).setDepth(40);

      this.panel = scene.add.rectangle(0, 0, 10, 10, COLOR_PRESETS.panel, 0.78).setOrigin(0);
      this.phaseText = scene.add.text(0, 0, "", this.createTextStyle(24, "#f9fafb", "bold"));
      this.timeText = scene.add.text(0, 0, "", this.createTextStyle(18));
      this.scoreText = scene.add.text(0, 0, "", this.createTextStyle(18));
      this.livesText = scene.add.text(0, 0, "", this.createTextStyle(18));
      this.audioText = scene.add.text(0, 0, "", this.createTextStyle(14, "#bfdbfe"));

      this.uiCard = scene.textures.exists("ui-panel")
        ? scene.add.image(0, 0, "ui-panel").setOrigin(0, 0.5)
        : scene.add.image(0, 0, "ui-cat-card").setOrigin(0, 0.5);

      this.lifeIcon = scene.add.image(0, 0, "ui-cat-card").setOrigin(0.5);
      this.powerIcon = scene.add.image(0, 0, "power-treat").setOrigin(0.5);

      this.root.add([
        this.panel,
        this.uiCard,
        this.lifeIcon,
        this.powerIcon,
        this.phaseText,
        this.timeText,
        this.scoreText,
        this.livesText,
        this.audioText
      ]);
    }

    createTextStyle(fontSize, color = "#e5e7eb", fontStyle = "normal") {
      return {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${fontSize}px`,
        color,
        fontStyle,
        stroke: "#0f172a",
        strokeThickness: 4
      };
    }

    layout(bounds) {
      const panelWidth = Math.min(bounds.width - 32, 360);
      const panelHeight = 110;

      this.root.setPosition(16, 16);
      this.panel.setSize(panelWidth, panelHeight);
      this.uiCard.setPosition(14, panelHeight / 2);
      this.uiCard.setDisplaySize(Math.min(88, panelWidth * 0.25), 44);

      this.lifeIcon.setPosition(panelWidth - 96, 34);
      this.lifeIcon.setDisplaySize(28, 28);

      this.powerIcon.setPosition(panelWidth - 36, 34);
      this.powerIcon.setDisplaySize(28, 28);

      this.phaseText.setPosition(98, 12);
      this.timeText.setPosition(98, 42);
      this.scoreText.setPosition(98, 66);
      this.livesText.setPosition(panelWidth - 156, 20);
      this.audioText.setPosition(panelWidth - 156, 48);
    }

    update(data) {
      this.phaseText.setText(`Fase ${data.phase}`);
      this.timeText.setText(`Tempo restante: ${data.timeLeft.toFixed(1)}s`);
      this.scoreText.setText(`Pontuacao: ${data.score}`);
      this.livesText.setText(`Tolerancia: ${data.extraLives}`);
      this.audioText.setText(data.audioLabel);
      this.panel.fillColor = data.panelColor;
    }
  }

  class ObstacleFactory {
    constructor(scene, group) {
      this.scene = scene;
      this.group = group;
      this.serial = 0;
    }

    spawn(type, config) {
      const { width, height, floorHeight } = this.scene.layout;
      const gapSize = Math.max(150, Math.round(height * config.gapRatio));
      const safeTop = 120;
      const safeBottom = height - floorHeight - 120;
      const centerY = Phaser.Math.Between(safeTop + (gapSize / 2), safeBottom - (gapSize / 2));
      const obstacleWidth = Phaser.Math.Clamp(Math.round(width * 0.14), 64, 110);
      const spawnX = width + obstacleWidth;

      const topHeight = Math.max(40, centerY - (gapSize / 2));
      const bottomHeight = Math.max(40, (height - floorHeight) - (centerY + (gapSize / 2)));

      const pieces = [];
      const styleMap = {
        pipe: { texture: "pipe-body", baseColor: COLOR_PRESETS.pipeLive, grayColor: COLOR_PRESETS.pipe },
        roof: { texture: "roof-body", baseColor: COLOR_PRESETS.roofLive, grayColor: COLOR_PRESETS.roof },
        dog: { texture: "dog-body", baseColor: COLOR_PRESETS.dogLive, grayColor: COLOR_PRESETS.dog }
      };

      const style = styleMap[type];

      pieces.push(
        this.createPiece({
          x: spawnX,
          y: topHeight,
          width: obstacleWidth,
          height: topHeight,
          originY: 1,
          speed: config.obstacleSpeed,
          texture: style.texture,
          baseColor: style.baseColor,
          grayColor: style.grayColor,
          obstacleType: type
        })
      );

      pieces.push(
        this.createPiece({
          x: spawnX,
          y: centerY + (gapSize / 2),
          width: obstacleWidth,
          height: bottomHeight,
          originY: 0,
          speed: config.obstacleSpeed,
          texture: style.texture,
          baseColor: style.baseColor,
          grayColor: style.grayColor,
          obstacleType: type
        })
      );

      if (type === "dog") {
        pieces.forEach((piece, index) => {
          piece.angle = index === 0 ? 180 : 0;
          piece.setScale(1, 1.02);
        });
      }

      const set = {
        id: this.serial += 1,
        type,
        pieces,
        scored: false
      };

      pieces.forEach((piece) => {
        piece.setData("obstacleSetId", set.id);
      });

      return set;
    }

    createPiece(config) {
      const saturation = this.scene.currentSaturation;
      const currentColor = mixColor(config.grayColor, config.baseColor, saturation);
      let piece;

      if (this.scene.textures.exists(config.texture)) {
        piece = this.scene.physics.add.image(config.x, config.y, config.texture);
        piece.setOrigin(0.5, config.originY);
        piece.displayWidth = config.width;
        piece.displayHeight = config.height;
        piece.setTint(currentColor);
      } else {
        piece = this.scene.add.rectangle(config.x, config.y, config.width, config.height, currentColor, 1).setOrigin(0.5, config.originY);
        this.scene.physics.add.existing(piece);
      }

      piece.body.setAllowGravity(false);
      piece.body.setImmovable(true);
      piece.body.setVelocityX(-config.speed);
      piece.body.setSize(config.width, config.height);
      piece.baseColor = config.baseColor;
      piece.grayColor = config.grayColor;
      piece.isObstacle = true;
      piece.obstacleType = config.obstacleType;

      if (!piece.scene || !piece.body) {
        this.scene.physics.add.existing(piece);
      }

      this.group.add(piece);

      return piece;
    }
  }

  function mixColor(grayHex, vividHex, factor) {
    const t = Phaser.Math.Clamp(factor, 0, 1);
    const gray = Phaser.Display.Color.IntegerToColor(grayHex);
    const vivid = Phaser.Display.Color.IntegerToColor(vividHex);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(gray, vivid, 100, Math.round(t * 100));
    return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
  }

  class BootScene extends Phaser.Scene {
    constructor() {
      super("BootScene");
      this.failedAssets = new Set();
    }

    preload() {
      this.cameras.main.setBackgroundColor("#05070d");

      const loadingText = this.add.text(this.scale.width / 2, this.scale.height / 2, "Carregando Muda...", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "26px",
        color: "#f9fafb"
      }).setOrigin(0.5);

      this.load.on("loaderror", (file) => {
        this.failedAssets.add(file.key);
      });

      this.load.on("progress", (progress) => {
        loadingText.setText(`Carregando Muda... ${Math.round(progress * 100)}%`);
      });

      this.load.image("muda-source", "muda.png");
      this.load.image("ui-source", "free.png");
      this.load.image("power-source", "RetroCatsFree.png");

      for (let phase = 1; phase <= TOTAL_PHASES; phase += 1) {
        this.load.audio(`music_phase_${phase}`, [
          `audio/fase${phase}.ogg`,
          `audio/fase${phase}.mp3`
        ]);
      }

      this.load.audio("sfx_flap", ["audio/flap.ogg", "audio/flap.mp3"]);
      this.load.audio("sfx_collect", ["audio/collect.ogg", "audio/collect.mp3"]);
      this.load.audio("sfx_hit", ["audio/hit.ogg", "audio/hit.mp3"]);
      this.load.audio("sfx_win", ["audio/win.ogg", "audio/win.mp3"]);
    }

    create() {
      AssetBuilder.ensurePipeline(this);
      AssetBuilder.ensureRuntimeTextures(this);

      this.registry.set("failedAssets", Array.from(this.failedAssets));
      this.registry.set("gameVersion", GAME_VERSION);
      this.registry.set("hasLocalAudio", PHASES.some((phase) => this.cache.audio.exists(phase.audioKey)));

      this.scene.start("MenuScene");
    }
  }

  class MenuScene extends Phaser.Scene {
    constructor() {
      super("MenuScene");
    }

    create() {
      this.cameras.main.setBackgroundColor("#0f172a");
      this.layout = getLayout(this.scale.width, this.scale.height);

      this.bgTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.55, 0x111827).setOrigin(0);
      this.bgBottom = this.add.rectangle(0, this.scale.height * 0.55, this.scale.width, this.scale.height * 0.45, 0x1d4ed8).setOrigin(0);

      this.title = this.add.text(0, 0, "Muda", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${Math.max(42, this.layout.width * 0.11)}px`,
        fontStyle: "bold",
        color: "#f9fafb",
        stroke: "#0f172a",
        strokeThickness: 8
      }).setOrigin(0.5);

      this.subtitle = this.add.text(0, 0, "Uma aventura felina em 7 fases para encontrar o miado perdido.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${Math.max(16, this.layout.width * 0.036)}px`,
        color: "#dbeafe",
        align: "center",
        wordWrap: { width: Math.min(420, this.layout.width - 40) }
      }).setOrigin(0.5);

      this.instructions = this.add.text(0, 0, [
        "Toque, clique ou pressione ESPACO para voar.",
        "Colete no maximo 3 power-ups por fase para ganhar tolerancia extra.",
        "Sobreviva ate a Fase 7 para recuperar o miado de gatinho."
      ], {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${Math.max(15, this.layout.width * 0.032)}px`,
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: Math.min(460, this.layout.width - 56) },
        lineSpacing: 8
      }).setOrigin(0.5);

      this.startButton = this.add.rectangle(0, 0, Math.min(260, this.layout.width - 64), 62, 0xfbbf24).setStrokeStyle(4, 0x7c2d12);
      this.startLabel = this.add.text(0, 0, "Comecar Jornada", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "24px",
        color: "#1f2937",
        fontStyle: "bold"
      }).setOrigin(0.5);

      this.footer = this.add.text(0, 0, `Rollback seguro ativo: game_v1.js | Melhor pontuacao: ${sharedState.bestScore}`, {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "14px",
        color: "#bfdbfe",
        align: "center"
      }).setOrigin(0.5);

      this.previewCat = this.add.image(0, 0, "muda-player").setScale(2.2);
      this.previewCat.angle = -4;

      this.previewPanel = this.textures.exists("ui-panel")
        ? this.add.image(0, 0, "ui-panel").setScale(0.7)
        : this.add.image(0, 0, "ui-cat-card").setScale(1.2);

      this.powerPanel = this.textures.exists("power-source")
        ? this.add.image(0, 0, "power-source").setScale(0.45)
        : this.add.image(0, 0, "power-treat").setScale(1.2);

      if (this.textures.exists("muda-source")) {
        this.heroPoster = this.add.image(0, 0, "muda-source");
        this.heroPoster.setScale(Math.min(0.38, (this.layout.width * 0.4) / this.heroPoster.width));
        this.heroPoster.setAlpha(0.18);
      }

      this.add.text(0, 0, "Fase 1 inicia em preto e branco.\nCada fase devolve cor ao mundo e a cauda arco-iris da Muda.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${Math.max(14, this.layout.width * 0.03)}px`,
        color: "#fde68a",
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: Math.min(420, this.layout.width - 48) }
      }).setOrigin(0.5).setPosition(this.layout.centerX, this.layout.height - 124);

      this.startButton.setInteractive({ useHandCursor: true });
      this.input.once("pointerdown", () => this.startGame());
      this.startButton.once("pointerdown", () => this.startGame());
      this.input.keyboard.once("keydown-SPACE", () => this.startGame());
      this.input.keyboard.once("keydown-UP", () => this.startGame());

      this.tweens.add({
        targets: this.previewCat,
        y: "+=12",
        angle: 6,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
      });

      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    startGame() {
      this.scene.start("GameScene", { phaseIndex: 0, score: 0, extraLives: 0 });
    }

    handleResize(gameSize) {
      this.layout = getLayout(gameSize.width, gameSize.height);
      this.bgTop.setSize(gameSize.width, gameSize.height * 0.55);
      this.bgBottom.setPosition(0, gameSize.height * 0.55).setSize(gameSize.width, gameSize.height * 0.45);

      this.title.setPosition(this.layout.centerX, 92);
      this.subtitle.setPosition(this.layout.centerX, 156);
      this.instructions.setPosition(this.layout.centerX, 250);
      this.previewCat.setPosition(this.layout.centerX - 24, 370);
      this.previewPanel.setPosition(this.layout.centerX, 448);
      this.powerPanel.setPosition(this.layout.centerX, 540);
      this.startButton.setPosition(this.layout.centerX, this.layout.height - 190);
      this.startLabel.setPosition(this.layout.centerX, this.layout.height - 190);
      this.footer.setPosition(this.layout.centerX, this.layout.height - 42);

      if (this.heroPoster) {
        this.heroPoster.setPosition(this.layout.centerX, this.layout.centerY + 30);
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
      this.currentSaturation = this.currentPhaseConfig.worldColor;
      this.phaseElapsedMs = 0;
      this.phaseTransitionActive = false;
      this.gameFinished = false;
      this.invulnerable = false;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;
      this.phasePowerUpTimers = [];
      this.obstacleSets = [];
      this.tailHistory = [];
      this.lastPaletteStep = -1;
      this.currentMusic = null;
      this.pauseBetweenPhases = null;

      this.physics.world.gravity.y = Math.round(this.layout.height * 1.1);

      this.createBackground();
      this.createGroups();
      this.createPlayer();
      this.createHud();
      this.createInput();

      this.obstacleFactory = new ObstacleFactory(this, this.obstacles);

      this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
      this.physics.add.overlap(this.player, this.obstacles, this.onPlayerHit, null, this);

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
        this.stopCurrentMusic();
      });

      this.startPhase(this.phaseIndex);
      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    createBackground() {
      this.skyTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.56, 0x6b7280).setOrigin(0);
      this.skyBottom = this.add.rectangle(0, this.scale.height * 0.56, this.scale.width, this.scale.height * 0.24, 0x94a3b8).setOrigin(0);
      this.horizonBand = this.add.rectangle(0, this.scale.height * 0.48, this.scale.width, this.scale.height * 0.18, 0x64748b).setOrigin(0);
      this.ground = this.add.rectangle(0, this.scale.height - this.layout.floorHeight, this.scale.width, this.layout.floorHeight, 0x2563eb).setOrigin(0);

      this.cityBlocks = [];
      for (let index = 0; index < 6; index += 1) {
        const block = this.add.rectangle(0, 0, 60, 120, 0x1d4ed8, 1).setOrigin(0.5, 1);
        this.cityBlocks.push(block);
      }

      this.sparkles = [];
      for (let index = 0; index < 12; index += 1) {
        const sparkle = this.add.circle(0, 0, Phaser.Math.Between(2, 4), 0xffffff, 0.45);
        sparkle.twinkleOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
        this.sparkles.push(sparkle);
      }

      this.tailGraphics = this.add.graphics().setDepth(12);
      this.phaseBanner = this.add.text(0, 0, "", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#fef3c7",
        stroke: "#0f172a",
        strokeThickness: 7,
        align: "center"
      }).setOrigin(0.5).setDepth(50).setAlpha(0);
    }

    createGroups() {
      this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
      this.powerUps = this.physics.add.group({ allowGravity: false, immovable: true });
    }

    createPlayer() {
      this.player = this.physics.add.sprite(this.layout.playerStartX, this.layout.centerY, "muda-player");
      this.player.setDepth(20);
      this.player.setCollideWorldBounds(false);
      this.player.body.setAllowRotation(false);
      this.player.setScale(Math.max(1.25, this.layout.width / 360));
      this.player.body.setSize(this.player.displayWidth * 0.72, this.player.displayHeight * 0.72, true);

      if (this.game.renderer.type === Phaser.WEBGL) {
        this.player.setPipeline("MudaRainbow");
      }
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
      if (this.phaseTransitionActive || this.gameFinished) {
        return;
      }

      this.player.setVelocityY(-Math.round(this.layout.height * 0.42));

      if (this.cache.audio.exists("sfx_flap")) {
        this.sound.play("sfx_flap", { volume: 0.3 });
      }
    }

    startPhase(index) {
      this.phaseIndex = index;
      this.currentPhaseConfig = PHASES[this.phaseIndex];
      this.phaseStartTime = this.time.now;
      this.phaseElapsedMs = 0;
      this.phaseTransitionActive = false;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

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
    }

    spawnObstacleSet() {
      if (this.phaseTransitionActive || this.gameFinished) {
        return;
      }

      const type = Phaser.Utils.Array.GetRandom(["pipe", "roof", "dog"]);
      const set = this.obstacleFactory.spawn(type, this.currentPhaseConfig);
      this.obstacleSets.push(set);
    }

    spawnPowerUp() {
      if (this.phaseTransitionActive || this.gameFinished || this.powerUpsSpawnedThisPhase >= 3) {
        return;
      }

      const powerKey = this.powerUpsSpawnedThisPhase % 2 === 0 ? "power-treat" : "power-treat-alt";
      const spawnX = this.layout.width + 64;
      const minY = 120;
      const maxY = this.layout.height - this.layout.floorHeight - 140;
      const y = Phaser.Math.Between(minY, maxY);

      let collectible;

      if (this.textures.exists(powerKey)) {
        collectible = this.physics.add.image(spawnX, y, powerKey);
        collectible.setDisplaySize(42, 42);
        collectible.setTint(mixColor(0xcbd5e1, COLOR_PRESETS.power, this.currentSaturation));
      } else {
        collectible = this.add.rectangle(spawnX, y, 36, 36, COLOR_PRESETS.power, 1);
        this.physics.add.existing(collectible);
      }

      collectible.body.setAllowGravity(false);
      collectible.body.setVelocityX(-this.currentPhaseConfig.powerUpDrift);
      collectible.body.setSize(32, 32);
      collectible.baseColor = COLOR_PRESETS.power;
      collectible.grayColor = 0xcbd5e1;
      collectible.floatSeed = Phaser.Math.FloatBetween(0, Math.PI * 2);
      collectible.spawnY = y;

      this.powerUps.add(collectible);
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
        this.sound.play("sfx_collect", { volume: 0.35 });
      }

      this.tweens.add({
        targets: this.player,
        scaleX: this.player.scaleX * 1.08,
        scaleY: this.player.scaleY * 1.08,
        yoyo: true,
        duration: 120
      });
    }

    onPlayerHit() {
      if (this.phaseTransitionActive || this.invulnerable || this.gameFinished) {
        return;
      }

      if (this.extraLives > 0) {
        this.extraLives -= 1;
        this.invulnerable = true;

        if (this.cache.audio.exists("sfx_hit")) {
          this.sound.play("sfx_hit", { volume: 0.35 });
        }

        this.tweens.add({
          targets: this.player,
          alpha: 0.25,
          duration: 120,
          yoyo: true,
          repeat: 5,
          onComplete: () => {
            this.invulnerable = false;
            this.player.setAlpha(1);
          }
        });

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
      this.stopCurrentMusic();

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));

      sharedState.bestScore = Math.max(sharedState.bestScore, this.score);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, String(sharedState.bestScore));

      if (victory) {
        if (this.cache.audio.exists("sfx_win")) {
          this.sound.play("sfx_win", { volume: 0.4 });
        }

        this.time.delayedCall(900, () => {
          this.scene.start("WinScene", {
            score: this.score,
            phase: this.currentPhaseConfig.number
          });
        });
        return;
      }

      this.time.delayedCall(650, () => {
        this.scene.start("GameOverScene", {
          score: this.score,
          phase: this.currentPhaseConfig.number
        });
      });
    }

    completePhase() {
      if (this.phaseTransitionActive) {
        return;
      }

      this.phaseTransitionActive = true;
      this.obstacleTimer.remove(false);
      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

      this.score += 10;

      if (this.phaseIndex >= TOTAL_PHASES - 1) {
        this.currentSaturation = 1;
        this.finishGame(true);
        return;
      }

      const nextPhaseNumber = this.phaseIndex + 2;
      this.updatePhaseBanner(`Fase ${this.phaseIndex + 1} concluida!\nMais cor para o mundo.\nProxima: Fase ${nextPhaseNumber}`);

      this.pauseBetweenPhases = this.time.delayedCall(2100, () => {
        this.startPhase(this.phaseIndex + 1);
      });
    }

    syncMusic() {
      this.stopCurrentMusic();

      if (!this.cache.audio.exists(this.currentPhaseConfig.audioKey)) {
        return;
      }

      this.currentMusic = this.sound.add(this.currentPhaseConfig.audioKey, {
        volume: 0.35,
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
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.36);
      this.tweens.killTweensOf(this.phaseBanner);
      this.phaseBanner.setAlpha(0);

      this.tweens.add({
        targets: this.phaseBanner,
        alpha: 1,
        duration: 280,
        yoyo: true,
        hold: 1250
      });
    }

    handleResize(gameSize) {
      this.layout = getLayout(gameSize.width, gameSize.height);
      this.physics.world.gravity.y = Math.round(this.layout.height * 1.1);

      this.skyTop.setSize(gameSize.width, gameSize.height * 0.56);
      this.skyBottom.setPosition(0, gameSize.height * 0.56).setSize(gameSize.width, gameSize.height * 0.24);
      this.horizonBand.setPosition(0, gameSize.height * 0.48).setSize(gameSize.width, gameSize.height * 0.18);
      this.ground.setPosition(0, gameSize.height - this.layout.floorHeight).setSize(gameSize.width, this.layout.floorHeight);

      this.cityBlocks.forEach((block, index) => {
        const spacing = gameSize.width / this.cityBlocks.length;
        block.x = (spacing * index) + (spacing * 0.5);
        block.y = gameSize.height - this.layout.floorHeight;
        block.width = Math.max(42, spacing * 0.45);
        block.height = 70 + ((index % 3) * 38);
      });

      this.sparkles.forEach((sparkle, index) => {
        if (!sparkle.baseX) {
          sparkle.baseX = Phaser.Math.Between(40, gameSize.width - 40);
          sparkle.baseY = Phaser.Math.Between(60, Math.max(100, gameSize.height * 0.52));
        }

        if (sparkle.baseX > gameSize.width - 20) {
          sparkle.baseX = Phaser.Math.Between(40, gameSize.width - 40);
        }

        sparkle.setPosition(sparkle.baseX, sparkle.baseY + (Math.sin((this.time.now * 0.0015) + index) * 4));
      });

      this.player.x = Math.min(this.player.x || this.layout.playerStartX, this.layout.playerStartX);
      this.player.x = this.layout.playerStartX;
      this.player.y = Phaser.Math.Clamp(this.player.y || this.layout.centerY, 110, gameSize.height - this.layout.floorHeight - 80);
      this.player.body.setSize(this.player.displayWidth * 0.72, this.player.displayHeight * 0.72, true);

      this.hud.layout(this.layout);
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.36);
    }

    update(time, delta) {
      if (this.gameFinished) {
        return;
      }

      this.phaseElapsedMs = time - this.phaseStartTime;
      const phaseDurationMs = this.currentPhaseConfig.duration * 1000;
      const phaseProgress = Phaser.Math.Clamp(this.phaseElapsedMs / phaseDurationMs, 0, 1);
      const startSaturation = this.phaseIndex / (TOTAL_PHASES - 1);
      const endSaturation = Math.min(1, (this.phaseIndex + 1) / (TOTAL_PHASES - 1));
      this.currentSaturation = Phaser.Math.Linear(startSaturation, endSaturation, phaseProgress);

      this.updatePalette();
      this.updatePlayerVisuals();
      this.updateTailTrail();
      this.updateObstacles();
      this.updatePowerUps(time);
      this.updateHud(phaseDurationMs);

      if (!this.phaseTransitionActive && phaseProgress >= 1) {
        this.completePhase();
      }

      if (!this.phaseTransitionActive) {
        const floorLimit = this.layout.height - this.layout.floorHeight - 8;

        if (this.player.y <= 26 || this.player.y >= floorLimit) {
          this.onPlayerHit();
        }
      }
    }

    updatePalette() {
      const satStep = Math.round(this.currentSaturation * 20);
      if (satStep === this.lastPaletteStep) {
        return;
      }

      this.lastPaletteStep = satStep;

      this.skyTop.fillColor = mixColor(COLOR_PRESETS.skyTop, COLOR_PRESETS.skyTopLive, this.currentSaturation);
      this.skyBottom.fillColor = mixColor(COLOR_PRESETS.skyBottom, COLOR_PRESETS.skyBottomLive, this.currentSaturation);
      this.horizonBand.fillColor = mixColor(COLOR_PRESETS.horizon, COLOR_PRESETS.horizonLive, this.currentSaturation);
      this.ground.fillColor = mixColor(COLOR_PRESETS.ground, COLOR_PRESETS.groundLive, this.currentSaturation);

      this.cityBlocks.forEach((block, index) => {
        const vivid = index % 2 === 0 ? 0x1d4ed8 : 0x2563eb;
        block.fillColor = mixColor(0x64748b, vivid, this.currentSaturation);
      });

      this.obstacles.children.each((obstacle) => {
        const color = mixColor(obstacle.grayColor || 0x94a3b8, obstacle.baseColor || 0xffffff, this.currentSaturation);
        if (obstacle.setTint) {
          obstacle.setTint(color);
        } else {
          obstacle.fillColor = color;
        }
      });

      this.powerUps.children.each((powerUp) => {
        const color = mixColor(powerUp.grayColor || 0xcbd5e1, powerUp.baseColor || COLOR_PRESETS.power, this.currentSaturation);
        if (powerUp.setTint) {
          powerUp.setTint(color);
        } else {
          powerUp.fillColor = color;
        }
      });
    }

    updatePlayerVisuals() {
      const angle = Phaser.Math.Clamp(this.player.body.velocity.y * 0.05, -18, 24);
      this.player.setAngle(angle);

      if (this.player.pipeline) {
        const pipeline = this.player.pipeline;
        pipeline.set1f("uSaturation", this.currentSaturation);
        pipeline.set1f("uRainbowProgress", Phaser.Math.Clamp((this.phaseIndex + (this.phaseElapsedMs / (this.currentPhaseConfig.duration * 1000))) / (TOTAL_PHASES - 1), 0, 1));
        pipeline.set1f("uTime", this.time.now);
      } else {
        this.player.setTint(mixColor(0xb6b7bb, 0xffffff, this.currentSaturation));
      }
    }

    updateTailTrail() {
      this.tailHistory.unshift({
        x: this.player.x - (this.player.displayWidth * 0.22),
        y: this.player.y + 4
      });

      if (this.tailHistory.length > 16) {
        this.tailHistory.length = 16;
      }

      const visibleColors = Math.max(0, Math.ceil(Phaser.Math.Clamp((this.phaseIndex + (this.phaseElapsedMs / (this.currentPhaseConfig.duration * 1000))) / (TOTAL_PHASES - 1), 0, 1) * RAINBOW_COLORS.length));

      this.tailGraphics.clear();

      if (visibleColors <= 0 || this.tailHistory.length < 3) {
        return;
      }

      for (let stripe = 0; stripe < visibleColors; stripe += 1) {
        this.tailGraphics.lineStyle(4, RAINBOW_COLORS[stripe], 0.65);
        this.tailGraphics.beginPath();

        this.tailHistory.forEach((point, index) => {
          const x = point.x - (index * 7);
          const y = point.y + ((stripe - (visibleColors / 2)) * 3);

          if (index === 0) {
            this.tailGraphics.moveTo(x, y);
          } else {
            this.tailGraphics.lineTo(x, y);
          }
        });

        this.tailGraphics.strokePath();
      }
    }

    updateObstacles() {
      this.obstacleSets = this.obstacleSets.filter((set) => {
        const activePieces = set.pieces.filter((piece) => piece.active);
        set.pieces = activePieces;

        if (activePieces.length === 0) {
          return false;
        }

        if (!set.scored) {
          const rightmost = Math.max(...activePieces.map((piece) => piece.x + ((piece.displayWidth || piece.width) * 0.5)));
          if (rightmost < this.player.x - 18) {
            set.scored = true;
            this.score += 1;
          }
        }

        activePieces.forEach((piece) => {
          if (piece.x < -140) {
            piece.destroy();
          }
        });

        return true;
      });
    }

    updatePowerUps(time) {
      this.powerUps.children.each((powerUp, index) => {
        if (!powerUp.active) {
          return;
        }

        powerUp.y = powerUp.spawnY + (Math.sin((time * 0.004) + powerUp.floatSeed) * 8);
        if (powerUp.body && powerUp.body.updateFromGameObject) {
          powerUp.body.updateFromGameObject();
        }

        if (powerUp.x < -80) {
          powerUp.destroy();
        }
      });

      this.sparkles.forEach((sparkle, index) => {
        sparkle.alpha = 0.25 + (0.3 * ((Math.sin((time * 0.003) + sparkle.twinkleOffset + index) + 1) * 0.5));
      });
    }

    updateHud(phaseDurationMs) {
      const timeLeft = Math.max(0, (phaseDurationMs - this.phaseElapsedMs) / 1000);
      this.hud.update({
        phase: this.currentPhaseConfig.number,
        timeLeft,
        score: this.score,
        extraLives: this.extraLives,
        audioLabel: this.cache.audio.exists(this.currentPhaseConfig.audioKey)
          ? `Trilha: ${this.currentPhaseConfig.audioStyle}`
          : `Audio local: ${this.currentPhaseConfig.audioStyle}`,
        panelColor: mixColor(COLOR_PRESETS.panel, COLOR_PRESETS.panelLive, this.currentSaturation)
      });
    }
  }

  class GameOverScene extends Phaser.Scene {
    constructor() {
      super("GameOverScene");
    }

    create(data) {
      this.cameras.main.setBackgroundColor("#111827");

      this.add.text(this.scale.width / 2, 120, "Game Over", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#f9fafb",
        stroke: "#7f1d1d",
        strokeThickness: 8
      }).setOrigin(0.5);

      this.add.text(this.scale.width / 2, 220, [
        `Voce chegou ate a Fase ${data.phase}.`,
        `Pontuacao final: ${data.score}.`,
        `Melhor pontuacao: ${sharedState.bestScore}.`
      ], {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "22px",
        color: "#e5e7eb",
        align: "center",
        lineSpacing: 12
      }).setOrigin(0.5);

      this.add.image(this.scale.width / 2, 360, "muda-player").setScale(2.6).setAngle(-12);

      this.add.text(this.scale.width / 2, this.scale.height - 140, "Toque, clique ou pressione ESPACO para tentar de novo.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fde68a",
        align: "center"
      }).setOrigin(0.5);

      this.add.text(this.scale.width / 2, this.scale.height - 96, "Rollback pronto em game_v1.js.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "14px",
        color: "#bfdbfe"
      }).setOrigin(0.5);

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
      this.cameras.main.setBackgroundColor("#0f172a");

      const centerX = this.scale.width / 2;

      this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a).setOrigin(0);
      this.add.rectangle(0, this.scale.height * 0.58, this.scale.width, this.scale.height * 0.42, 0x1d4ed8).setOrigin(0);

      this.add.text(centerX, 120, "Vitoria!", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "52px",
        fontStyle: "bold",
        color: "#fef3c7",
        stroke: "#7c2d12",
        strokeThickness: 8
      }).setOrigin(0.5);

      this.add.text(centerX, 220, [
        "A Muda concluiu a Fase 7.",
        "O mundo voltou a ficar colorido.",
        "Seu miado de gatinho foi encontrado!"
      ], {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "24px",
        color: "#f9fafb",
        align: "center",
        lineSpacing: 12
      }).setOrigin(0.5);

      const hero = this.add.image(centerX, 360, "muda-player").setScale(3.2);
      if (this.game.renderer.type === Phaser.WEBGL) {
        hero.setPipeline("MudaRainbow");
        const pipeline = hero.pipeline;
        pipeline.set1f("uSaturation", 1);
        pipeline.set1f("uRainbowProgress", 1);
        pipeline.set1f("uTime", this.time.now);
      }

      this.add.text(centerX, 500, `Pontuacao final: ${data.score}`, {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "26px",
        color: "#dbeafe"
      }).setOrigin(0.5);

      this.add.text(centerX, this.scale.height - 130, "Toque, clique ou pressione ESPACO para voltar ao menu.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fde68a",
        align: "center"
      }).setOrigin(0.5);

      this.input.once("pointerdown", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-UP", () => this.scene.start("MenuScene"));
    }
  }

  function getLayout(width, height) {
    return {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      floorHeight: Math.max(96, Math.round(height * 0.14)),
      playerStartX: Math.round(width * 0.26)
    };
  }

  const gameConfig = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#05070d",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 980 },
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, WinScene]
  };

  window.MudaGame = new Phaser.Game(gameConfig);
})();
