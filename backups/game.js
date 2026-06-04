/*
  Muda - Versao incremental v2

  Teste local:
  - Esta estrutura continua pronta para abrir direto pelo index.html.
  - Se o navegador bloquear PNGs ou audios no protocolo file://, use Live Server.

  Rollback:
  - Antes desta atualizacao, a versao anterior foi preservada em game_v2_backup.js.
  - Se precisar reverter rapidamente, troque a referencia do index.html para game_v2_backup.js.
*/

(() => {
  const GAME_VERSION = "v2";
  const TOTAL_PHASES = 7;
  const POWERUP_SPAWN_MARKERS = [0.22, 0.55, 0.82];
  const LOCAL_STORAGE_KEY = "muda-best-score";
  const RAINBOW_COLORS = [0xff335f, 0xff8c42, 0xffd23f, 0x78d64b, 0x18a0fb, 0x5f4bdb, 0xd94cff];

  const PHASES = Array.from({ length: TOTAL_PHASES }, (_, index) => {
    const phaseNumber = index + 1;
    const speedFactor = Number(Math.pow(1.15, index).toFixed(4));

    return {
      number: phaseNumber,
      duration: 30 + (index * 10),
      speedFactor,
      obstacleSpeed: Math.round(220 * speedFactor),
      spawnDelay: Math.max(880, Math.round(1680 / Math.pow(1.08, index))),
      gapRatio: Math.max(0.21, 0.34 - (index * 0.018)),
      powerUpSpeed: Math.round(150 * speedFactor),
      parallaxFar: 18 * speedFactor,
      parallaxMid: 36 * speedFactor,
      parallaxNear: 74 * speedFactor,
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

  const COLOR_PRESETS = {
    skyTopGray: 0x777a81,
    skyTopColor: 0x87d9ff,
    skyBottomGray: 0xb3b6bf,
    skyBottomColor: 0xd7f0ff,
    horizonGray: 0x858b96,
    horizonColor: 0x69b5ff,
    groundGray: 0x555a63,
    groundColor: 0x2f64dd,
    houseGray: 0x6d727b,
    houseColor: 0x7db4ff,
    roofGray: 0x8b817c,
    roofColor: 0xfa7f95,
    pipeGray: 0x7c848d,
    pipeColor: 0x82f11b,
    dogGray: 0x7e756d,
    dogColor: 0xe7b07d,
    sparkleGray: 0xd7d7d7,
    sparkleColor: 0xffffff,
    panelGray: 0x151821,
    panelColor: 0x123e67,
    uiGray: 0xd0d4db,
    uiColor: 0xffffff,
    powerGray: 0xd9d9d9,
    powerColor: 0xfbbf24
  };

  const CROPS = {
    /* Recorte da gatinha dentro da imagem de referencia muda.png */
    mudaPlayer: { x: 236, y: 185, width: 112, height: 66 },

    /* Folha free.png usada para elementos de HUD de gato */
    hudLifeIcon: { x: 2, y: 65, width: 30, height: 30 },
    hudLifeIconAlt: { x: 34, y: 65, width: 30, height: 30 },

    /* Folha RetroCatsFree.png usada para petiscos e brinquedos */
    powerTreat: { x: 0, y: 0, width: 52, height: 32 },
    powerToy: { x: 52, y: 0, width: 52, height: 32 }
  };

  const sharedState = {
    bestScore: Number(window.localStorage.getItem(LOCAL_STORAGE_KEY) || 0)
  };

  class RainbowTrailPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
      super({
        game,
        fragShader: `
          precision mediump float;

          uniform sampler2D uMainSampler;
          varying vec2 outTexCoord;
          varying vec4 outTint;

          uniform float uTime;
          uniform float uAlpha;

          vec3 rainbowColor(float t) {
            if (t < 0.142857) return vec3(1.00, 0.20, 0.37);
            if (t < 0.285714) return vec3(1.00, 0.56, 0.22);
            if (t < 0.428571) return vec3(1.00, 0.84, 0.20);
            if (t < 0.571428) return vec3(0.45, 0.86, 0.24);
            if (t < 0.714285) return vec3(0.10, 0.67, 1.00);
            if (t < 0.857142) return vec3(0.38, 0.33, 0.92);
            return vec3(0.86, 0.27, 1.00);
          }

          void main() {
            vec4 tex = texture2D(uMainSampler, outTexCoord) * outTint;

            if (tex.a <= 0.01) {
              gl_FragColor = vec4(0.0);
              return;
            }

            vec2 uv = outTexCoord;
            float waveA = sin((uv.x * 15.0) - (uTime * 0.0065)) * 0.055;
            float waveB = cos((uv.x * 24.0) - (uTime * 0.0045)) * 0.02;
            float warpedY = clamp(uv.y + waveA + waveB, 0.0, 0.999);
            float band = floor((1.0 - warpedY) * 7.0);
            float paletteT = clamp((band + 0.5) / 7.0, 0.0, 1.0);

            vec3 rgb = rainbowColor(paletteT);
            float headStrength = pow(uv.x, 1.55);
            float bodyFade = smoothstep(0.0, 0.10, uv.x);
            float verticalSoft = smoothstep(0.0, 0.10, uv.y) * smoothstep(0.0, 0.10, 1.0 - uv.y);
            float shimmer = 0.84 + (0.16 * sin((uv.x * 32.0) - (uTime * 0.012)));
            float alpha = tex.a * uAlpha * headStrength * bodyFade * verticalSoft;

            gl_FragColor = vec4(rgb * shimmer, alpha);
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

      if (!scene.game.renderer.pipelines.has("MudaRainbowTrail")) {
        scene.game.renderer.pipelines.add("MudaRainbowTrail", new RainbowTrailPipeline(scene.game));
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

      for (let index = 0; index < data.length; index += 4) {
        const dr = data[index] - chroma.r;
        const dg = data[index + 1] - chroma.g;
        const db = data[index + 2] - chroma.b;
        const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

        if (distance < chroma.tolerance) {
          data[index + 3] = 0;
          continue;
        }

        if (data[index + 3] > 0) {
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
      this.generateTexture(scene, "muda-player", 92, 58, (g) => {
        g.fillStyle(0x4b3b34, 1);
        g.fillRoundedRect(20, 19, 46, 24, 10);
        g.fillRoundedRect(50, 15, 22, 22, 8);
        g.fillStyle(0xf0e9dd, 1);
        g.fillRoundedRect(22, 21, 38, 18, 8);
        g.fillStyle(0x8f6d58, 1);
        g.fillRoundedRect(52, 19, 14, 13, 4);
        g.fillTriangle(53, 16, 58, 5, 62, 16);
        g.fillTriangle(62, 16, 67, 5, 72, 16);
        g.fillRect(12, 24, 12, 6);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(59, 25, 2.6);
      });

      this.generateTexture(scene, "hud-life-icon", 28, 28, (g) => {
        g.fillStyle(0xf1ede6, 1);
        g.fillRoundedRect(6, 10, 14, 10, 4);
        g.fillStyle(0x8f6d58, 1);
        g.fillRoundedRect(15, 8, 8, 8, 3);
        g.fillTriangle(14, 9, 16, 4, 18, 9);
        g.fillTriangle(19, 9, 21, 4, 23, 9);
      });

      this.generateTexture(scene, "power-treat", 44, 30, (g) => {
        g.fillStyle(0xfbbf24, 1);
        g.fillRoundedRect(4, 6, 36, 18, 8);
        g.fillStyle(0xffffff, 0.45);
        g.fillCircle(14, 12, 4);
      });

      this.generateTexture(scene, "power-toy", 38, 38, (g) => {
        g.fillStyle(0xf472b6, 1);
        g.fillCircle(19, 19, 13);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(13, 13, 4);
      });

      this.generateTexture(scene, "pipe-body", 64, 128, (g) => {
        g.fillStyle(0x82f11b, 1);
        g.fillRect(8, 8, 48, 120);
        g.fillStyle(0x56b80f, 1);
        g.fillRect(8, 8, 10, 120);
        g.fillStyle(0xb2ff5d, 1);
        g.fillRect(28, 8, 8, 120);
        g.fillStyle(0x6ac814, 1);
        g.fillRect(0, 0, 64, 20);
        g.fillRect(0, 108, 64, 20);
      });

      this.generateTexture(scene, "roof-body", 64, 128, (g) => {
        g.fillStyle(0xfb7185, 1);
        g.fillRect(8, 18, 48, 110);
        g.fillStyle(0x7b4f2a, 1);
        g.fillRect(0, 0, 64, 24);
        g.lineStyle(2, 0xfbcfe8, 1);
        for (let y = 4; y < 24; y += 6) {
          g.lineBetween(0, y, 64, y);
        }
      });

      this.generateTexture(scene, "dog-body", 70, 96, (g) => {
        g.fillStyle(0xe7b07d, 1);
        g.fillRoundedRect(12, 28, 46, 28, 12);
        g.fillRoundedRect(40, 18, 18, 18, 7);
        g.fillTriangle(42, 18, 48, 6, 52, 18);
        g.fillTriangle(52, 18, 58, 6, 62, 18);
        g.fillStyle(0x7c5b45, 1);
        g.fillRoundedRect(14, 34, 16, 16, 8);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(50, 27, 2.4);
      });

      this.generateTexture(scene, "trail-strip", 256, 64, (g) => {
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(0, 10, 256, 44, 24);
      });

      this.generateTexture(scene, "ui-panel", 256, 96, (g) => {
        g.fillStyle(0x0f172a, 0.86);
        g.fillRoundedRect(0, 0, 256, 96, 18);
      });
    }

    static ensureRuntimeTextures(scene) {
      let playerPrepared = false;

      if (scene.textures.exists("muda-source")) {
        playerPrepared = this.cropTextureWithChroma(
          scene,
          "muda-source",
          "muda-player",
          CROPS.mudaPlayer,
          { r: 72, g: 175, b: 239, tolerance: 90 }
        );
      }

      if (scene.textures.exists("ui-source")) {
        this.cropTexture(scene, "ui-source", "hud-life-icon", CROPS.hudLifeIcon);
        this.cropTexture(scene, "ui-source", "hud-life-icon-alt", CROPS.hudLifeIconAlt);
      }

      if (scene.textures.exists("power-source")) {
        this.cropTexture(scene, "power-source", "power-treat", CROPS.powerTreat);
        this.cropTexture(scene, "power-source", "power-toy", CROPS.powerToy);
      }

      this.createFallbackTextures(scene);

      if (!playerPrepared && scene.textures.exists("muda-source") && !scene.textures.exists("muda-player")) {
        this.generateTexture(scene, "muda-player", 92, 58, (g) => {
          g.fillStyle(0x4b3b34, 1);
          g.fillRoundedRect(20, 19, 46, 24, 10);
          g.fillRoundedRect(50, 15, 22, 22, 8);
          g.fillStyle(0xf0e9dd, 1);
          g.fillRoundedRect(22, 21, 38, 18, 8);
          g.fillStyle(0x8f6d58, 1);
          g.fillRoundedRect(52, 19, 14, 13, 4);
          g.fillTriangle(53, 16, 58, 5, 62, 16);
          g.fillTriangle(62, 16, 67, 5, 72, 16);
          g.fillRect(12, 24, 12, 6);
          g.fillStyle(0x1f2937, 1);
          g.fillCircle(59, 25, 2.6);
        });
      }
    }
  }

  class HUDController {
    constructor(scene) {
      this.scene = scene;
      this.root = scene.add.container(0, 0).setDepth(50);
      this.lastLivesCount = -1;

      this.panel = scene.add.image(0, 0, "ui-panel").setOrigin(0, 0);
      this.phaseText = scene.add.text(0, 0, "", this.createTextStyle(22, "#f9fafb", "bold"));
      this.timeText = scene.add.text(0, 0, "", this.createTextStyle(17));
      this.scoreText = scene.add.text(0, 0, "", this.createTextStyle(17));
      this.audioText = scene.add.text(0, 0, "", this.createTextStyle(14, "#dbeafe"));
      this.livesLabel = scene.add.text(0, 0, "Tolerancia", this.createTextStyle(16));
      this.powerLabel = scene.add.text(0, 0, "", this.createTextStyle(15, "#fde68a"));
      this.lifeIcons = [];
      this.powerIcon = scene.add.image(0, 0, "power-treat").setOrigin(0.5);

      this.root.add([
        this.panel,
        this.phaseText,
        this.timeText,
        this.scoreText,
        this.audioText,
        this.livesLabel,
        this.powerLabel,
        this.powerIcon
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
      const panelWidth = Math.min(bounds.width - 24, 390);
      const panelHeight = 112;

      this.root.setPosition(12, 12);
      this.panel.setDisplaySize(panelWidth, panelHeight);
      this.phaseText.setPosition(18, 12);
      this.timeText.setPosition(18, 42);
      this.scoreText.setPosition(18, 66);
      this.audioText.setPosition(18, 88);
      this.livesLabel.setPosition(panelWidth - 178, 12);
      this.powerLabel.setPosition(panelWidth - 178, 82);
      this.powerIcon.setPosition(panelWidth - 34, 90);
      this.powerIcon.setDisplaySize(28, 20);

      this.reflowLifeIcons(0);
    }

    reflowLifeIcons(count) {
      const panelWidth = this.panel.displayWidth;
      const startX = panelWidth - 170;
      const startY = 42;

      this.lifeIcons.forEach((icon) => icon.destroy());
      this.lifeIcons = [];

      const maxVisibleIcons = Math.min(count, 6);
      for (let index = 0; index < maxVisibleIcons; index += 1) {
        const texture = index % 2 === 0 && this.scene.textures.exists("hud-life-icon-alt")
          ? "hud-life-icon-alt"
          : "hud-life-icon";
        const icon = this.scene.add.image(startX + (index * 24), startY, texture).setOrigin(0, 0.5);
        icon.setDisplaySize(22, 22);
        this.lifeIcons.push(icon);
        this.root.add(icon);
      }

      if (count > maxVisibleIcons) {
        const plusText = this.scene.add.text(
          startX + (maxVisibleIcons * 24) + 4,
          startY,
          `+${count - maxVisibleIcons}`,
          this.createTextStyle(14, "#f9fafb", "bold")
        ).setOrigin(0, 0.5);

        this.lifeIcons.push(plusText);
        this.root.add(plusText);
      }
    }

    update(data) {
      this.phaseText.setText(`Fase ${data.phase}`);
      this.timeText.setText(`Tempo restante: ${data.timeLeft.toFixed(1)}s`);
      this.scoreText.setText(`Pontuacao: ${data.score}`);
      this.audioText.setText(data.audioLabel);
      this.powerLabel.setText(`Power-ups da fase: ${data.powerUpsCollected}/${data.powerUpsLimit}`);
      this.panel.setTint(data.panelTint);
      this.powerIcon.setTint(data.uiTint);

      this.livesLabel.setColor("#f9fafb");
      if (this.lastLivesCount !== data.extraLives) {
        this.reflowLifeIcons(data.extraLives);
        this.lastLivesCount = data.extraLives;
      }

      this.lifeIcons.forEach((icon) => {
        if (icon.setTint) {
          icon.setTint(data.uiTint);
        }
      });
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
      const safeTop = 104;
      const safeBottom = height - floorHeight - 104;
      const centerY = Phaser.Math.Between(
        Math.round(safeTop + (gapSize * 0.5)),
        Math.round(safeBottom - (gapSize * 0.5))
      );
      const obstacleWidth = Phaser.Math.Clamp(Math.round(width * 0.14), 72, 118);
      const spawnX = width + obstacleWidth;
      const topHeight = Math.max(48, Math.round(centerY - (gapSize * 0.5)));
      const bottomHeight = Math.max(48, Math.round((height - floorHeight) - (centerY + (gapSize * 0.5))));
      const styleMap = {
        pipe: { texture: "pipe-body", baseColor: COLOR_PRESETS.pipeColor, grayColor: COLOR_PRESETS.pipeGray },
        roof: { texture: "roof-body", baseColor: COLOR_PRESETS.roofColor, grayColor: COLOR_PRESETS.roofGray },
        dog: { texture: "dog-body", baseColor: COLOR_PRESETS.dogColor, grayColor: COLOR_PRESETS.dogGray }
      };
      const style = styleMap[type];

      const pieces = [
        this.createPiece({
          x: spawnX,
          y: topHeight,
          width: obstacleWidth,
          height: topHeight,
          originY: 1,
          texture: style.texture,
          speed: config.obstacleSpeed,
          baseColor: style.baseColor,
          grayColor: style.grayColor,
          obstacleType: type
        }),
        this.createPiece({
          x: spawnX,
          y: centerY + (gapSize * 0.5),
          width: obstacleWidth,
          height: bottomHeight,
          originY: 0,
          texture: style.texture,
          speed: config.obstacleSpeed,
          baseColor: style.baseColor,
          grayColor: style.grayColor,
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
      piece.setDepth(22);
      piece.baseColor = config.baseColor;
      piece.grayColor = config.grayColor;
      piece.obstacleType = config.obstacleType;

      if (piece.setTint) {
        piece.setTint(tint);
      } else {
        piece.fillColor = tint;
      }

      piece.body.setAllowGravity(false);
      piece.body.setImmovable(true);
      piece.body.moves = true;
      piece.body.setVelocityX(-config.speed);
      piece.body.setSize(config.width * 0.92, config.height * 0.92, true);

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

  function getLayout(width, height) {
    return {
      width,
      height,
      centerX: width * 0.5,
      centerY: height * 0.5,
      floorHeight: Math.max(92, Math.round(height * 0.15)),
      playerStartX: Math.round(width * 0.24)
    };
  }

  class BootScene extends Phaser.Scene {
    constructor() {
      super("BootScene");
      this.failedAssets = new Set();
    }

    preload() {
      this.cameras.main.setBackgroundColor("#05070d");

      const loadingText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, "Carregando Muda...", {
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

      this.load.image("muda-source", "./muda.png");
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
      AssetBuilder.ensurePipeline(this);
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
      this.cameras.main.setBackgroundColor("#0f172a");

      this.bgTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.58, 0x111827).setOrigin(0);
      this.bgBottom = this.add.rectangle(0, this.scale.height * 0.58, this.scale.width, this.scale.height * 0.42, 0x1d4ed8).setOrigin(0);

      this.title = this.add.text(this.layout.centerX, 88, "Muda", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: `${Math.max(42, this.layout.width * 0.1)}px`,
        color: "#f9fafb",
        fontStyle: "bold",
        stroke: "#0f172a",
        strokeThickness: 8
      }).setOrigin(0.5);

      this.subtitle = this.add.text(
        this.layout.centerX,
        156,
        "Side-scroller felino em 7 fases.\nToque para voar, desvie dos obstaculos e devolva as cores ao mundo.",
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: `${Math.max(16, this.layout.width * 0.034)}px`,
          color: "#dbeafe",
          align: "center",
          lineSpacing: 8,
          wordWrap: { width: Math.min(480, this.layout.width - 48) }
        }
      ).setOrigin(0.5);

      this.hero = this.add.image(this.layout.centerX, this.layout.centerY + 8, "muda-player");
      const desiredHeroWidth = Phaser.Math.Clamp(this.layout.width * 0.22, 130, 210);
      this.hero.setScale(desiredHeroWidth / this.hero.width);
      this.hero.setAngle(-6);

      this.startButton = this.add.rectangle(this.layout.centerX, this.layout.height - 180, Math.min(290, this.layout.width - 56), 68, 0xfbbf24)
        .setStrokeStyle(4, 0x7c2d12)
        .setInteractive({ useHandCursor: true });

      this.startLabel = this.add.text(this.layout.centerX, this.layout.height - 180, "Comecar Jornada", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "24px",
        color: "#1f2937",
        fontStyle: "bold"
      }).setOrigin(0.5);

      this.footer = this.add.text(
        this.layout.centerX,
        this.layout.height - 48,
        `Rollback seguro: game_v2_backup.js | Melhor pontuacao: ${sharedState.bestScore}`,
        {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: "14px",
          color: "#bfdbfe",
          align: "center"
        }
      ).setOrigin(0.5);

      this.startButton.once("pointerdown", () => this.startGame());
      this.input.once("pointerdown", () => this.startGame());
      this.input.keyboard.once("keydown-SPACE", () => this.startGame());
      this.input.keyboard.once("keydown-UP", () => this.startGame());

      this.tweens.add({
        targets: this.hero,
        y: this.hero.y + 12,
        angle: 7,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }

    startGame() {
      this.scene.start("GameScene", { phaseIndex: 0, score: 0, extraLives: 0 });
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
      this.targetWorldSaturation = this.currentPhaseConfig.saturation;
      this.phaseElapsedMs = 0;
      this.phaseTransitionActive = false;
      this.gameFinished = false;
      this.invulnerable = false;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;
      this.phasePowerUpTimers = [];
      this.obstacleSets = [];
      this.currentMusic = null;
      this.worldTintStamp = -1;
      this.parallaxItems = [];
      this.groundLines = [];
      this.sparkles = [];
      this.tailHistory = [];

      this.physics.world.gravity.y = 940;
      this.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);

      this.createBackground();
      this.createGroups();
      this.createPlayer();
      this.createTail();
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
        this.stopCurrentMusic();
      });

      this.startPhase(this.phaseIndex);
      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    createBackground() {
      this.skyTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.56, COLOR_PRESETS.skyTopGray).setOrigin(0);
      this.skyBottom = this.add.rectangle(0, this.scale.height * 0.56, this.scale.width, this.scale.height * 0.24, COLOR_PRESETS.skyBottomGray).setOrigin(0);
      this.horizonBand = this.add.rectangle(0, this.scale.height * 0.48, this.scale.width, this.scale.height * 0.18, COLOR_PRESETS.horizonGray).setOrigin(0);
      this.ground = this.add.rectangle(0, this.scale.height - this.layout.floorHeight, this.scale.width, this.layout.floorHeight, COLOR_PRESETS.groundGray).setOrigin(0);

      for (let index = 0; index < 6; index += 1) {
        this.parallaxItems.push(this.createHouse("far"));
      }

      for (let index = 0; index < 5; index += 1) {
        this.parallaxItems.push(this.createRoofline("mid"));
      }

      for (let index = 0; index < 8; index += 1) {
        const line = this.add.rectangle(0, 0, Phaser.Math.Between(70, 130), 6, COLOR_PRESETS.groundGray, 1).setOrigin(0.5);
        line.speedKey = "parallaxNear";
        line.grayColor = COLOR_PRESETS.groundGray;
        line.baseColor = COLOR_PRESETS.groundColor;
        this.groundLines.push(line);
      }

      for (let index = 0; index < 12; index += 1) {
        const sparkle = this.add.circle(0, 0, Phaser.Math.Between(2, 4), COLOR_PRESETS.sparkleGray, 0.55);
        sparkle.grayColor = COLOR_PRESETS.sparkleGray;
        sparkle.baseColor = COLOR_PRESETS.sparkleColor;
        sparkle.twinkleOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
        sparkle.speedFactor = Phaser.Math.FloatBetween(0.75, 1.2);
        this.sparkles.push(sparkle);
      }

      this.phaseBanner = this.add.text(0, 0, "", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#fef3c7",
        stroke: "#0f172a",
        strokeThickness: 7,
        align: "center"
      }).setOrigin(0.5).setDepth(60).setAlpha(0);
    }

    createHouse(layerName) {
      const container = this.add.container(0, 0);
      const body = this.add.rectangle(0, 0, 92, 68, COLOR_PRESETS.houseGray).setOrigin(0.5, 1);
      const roof = this.add.triangle(0, 0, 0, 0, 58, -34, 116, 0, COLOR_PRESETS.roofGray).setOrigin(0.5, 1);
      roof.y = -66;
      container.add([body, roof]);
      container.baseColor = COLOR_PRESETS.houseColor;
      container.grayColor = COLOR_PRESETS.houseGray;
      container.roofBaseColor = COLOR_PRESETS.roofColor;
      container.roofGrayColor = COLOR_PRESETS.roofGray;
      container.speedKey = layerName === "far" ? "parallaxFar" : "parallaxMid";
      container.visualParts = { body, roof };
      return container;
    }

    createRoofline(layerName) {
      const container = this.add.container(0, 0);
      const base = this.add.rectangle(0, 0, 132, 26, COLOR_PRESETS.houseGray).setOrigin(0.5, 1);
      const top = this.add.rectangle(0, -24, 118, 18, COLOR_PRESETS.roofGray).setOrigin(0.5, 1);
      container.add([base, top]);
      container.baseColor = COLOR_PRESETS.houseColor;
      container.grayColor = COLOR_PRESETS.houseGray;
      container.roofBaseColor = COLOR_PRESETS.roofColor;
      container.roofGrayColor = COLOR_PRESETS.roofGray;
      container.speedKey = layerName === "mid" ? "parallaxMid" : "parallaxNear";
      container.visualParts = { body: base, roof: top };
      return container;
    }

    createGroups() {
      this.obstacles = this.physics.add.group({
        allowGravity: false,
        immovable: true,
        runChildUpdate: false
      });

      this.powerUps = this.physics.add.group({
        allowGravity: false,
        immovable: true,
        runChildUpdate: false
      });
    }

    createPlayer() {
      this.player = this.physics.add.sprite(this.layout.playerStartX, this.layout.centerY, "muda-player");
      this.player.setDepth(30);
      this.player.setCollideWorldBounds(false);
      this.player.body.setAllowGravity(true);
      this.player.body.setMaxVelocity(9999, 620);

      const desiredWidth = Phaser.Math.Clamp(this.layout.width * 0.11, 76, 108);
      this.player.setScale(desiredWidth / this.player.width);
      this.player.body.setSize(this.player.displayWidth * 0.56, this.player.displayHeight * 0.62, true);
      this.player.body.setOffset(this.player.displayWidth * 0.24, this.player.displayHeight * 0.2);
    }

    createTail() {
      if (this.game.renderer.type === Phaser.WEBGL) {
        this.tailSprite = this.add.image(0, 0, "trail-strip").setOrigin(1, 0.5).setDepth(24);
        this.tailSprite.setBlendMode(Phaser.BlendModes.ADD);
        this.tailSprite.setPipeline("MudaRainbowTrail");
      } else {
        this.tailFallback = this.add.graphics().setDepth(24);
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
      if (this.phaseTransitionActive || this.gameFinished || !this.player.body) {
        return;
      }

      this.player.setVelocityY(-Math.round(Math.max(320, this.layout.height * 0.44)));

      if (this.cache.audio.exists("sfx_flap")) {
        this.sound.play("sfx_flap", { volume: 0.28 });
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

      this.targetWorldSaturation = this.currentPhaseConfig.saturation;
      this.tweenWorldSaturation(this.targetWorldSaturation);

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

      /* Um disparo inicial deixa claro que o spawn esta ativo e corrige o vazio inicial. */
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

      const type = Phaser.Utils.Array.GetRandom(["pipe", "roof", "dog"]);
      const set = this.obstacleFactory.spawn(type, this.currentPhaseConfig);
      this.obstacleSets.push(set);
    }

    spawnPowerUp() {
      if (this.phaseTransitionActive || this.gameFinished || this.powerUpsSpawnedThisPhase >= 3) {
        return;
      }

      const powerKey = this.powerUpsSpawnedThisPhase % 2 === 0 ? "power-treat" : "power-toy";
      const spawnX = this.layout.width + 70;
      const minY = 120;
      const maxY = this.layout.height - this.layout.floorHeight - 130;
      const y = Phaser.Math.Between(minY, maxY);
      let collectible;

      if (this.textures.exists(powerKey)) {
        collectible = this.powerUps.create(spawnX, y, powerKey);
        collectible.setDisplaySize(powerKey === "power-treat" ? 44 : 34, powerKey === "power-treat" ? 26 : 34);
      } else {
        collectible = this.add.rectangle(spawnX, y, 36, 36, COLOR_PRESETS.powerColor, 1);
        this.physics.add.existing(collectible);
        this.powerUps.add(collectible);
      }

      collectible.setDepth(26);
      collectible.baseColor = COLOR_PRESETS.powerColor;
      collectible.grayColor = COLOR_PRESETS.powerGray;
      collectible.spawnY = y;
      collectible.floatSeed = Phaser.Math.FloatBetween(0, Math.PI * 2);

      if (collectible.setTint) {
        collectible.setTint(mixColor(COLOR_PRESETS.powerGray, COLOR_PRESETS.powerColor, this.worldSaturation));
      } else {
        collectible.fillColor = mixColor(COLOR_PRESETS.powerGray, COLOR_PRESETS.powerColor, this.worldSaturation);
      }

      collectible.body.setAllowGravity(false);
      collectible.body.moves = true;
      collectible.body.setVelocityX(-this.currentPhaseConfig.powerUpSpeed);
      collectible.body.setSize(collectible.displayWidth * 0.8, collectible.displayHeight * 0.8, true);

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
        this.sound.play("sfx_collect", { volume: 0.33 });
      }

      this.tweens.add({
        targets: this.player,
        scaleX: this.player.scaleX * 1.08,
        scaleY: this.player.scaleY * 1.08,
        duration: 120,
        yoyo: true
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
          this.sound.play("sfx_hit", { volume: 0.34 });
        }

        this.tweens.add({
          targets: this.player,
          alpha: 0.2,
          duration: 110,
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
        `Fase ${this.currentPhaseConfig.number} concluida!\nVelocidade +15% e mais cor no mundo.`
      );

      this.time.delayedCall(1800, () => {
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
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.33);
      this.tweens.killTweensOf(this.phaseBanner);
      this.phaseBanner.setAlpha(0);

      this.tweens.add({
        targets: this.phaseBanner,
        alpha: 1,
        duration: 260,
        yoyo: true,
        hold: 1100
      });
    }

    refreshWorldColors(force = false) {
      const tintStep = Math.round(this.worldSaturation * 24);
      if (!force && tintStep === this.worldTintStamp) {
        return;
      }

      this.worldTintStamp = tintStep;

      this.skyTop.fillColor = mixColor(COLOR_PRESETS.skyTopGray, COLOR_PRESETS.skyTopColor, this.worldSaturation);
      this.skyBottom.fillColor = mixColor(COLOR_PRESETS.skyBottomGray, COLOR_PRESETS.skyBottomColor, this.worldSaturation);
      this.horizonBand.fillColor = mixColor(COLOR_PRESETS.horizonGray, COLOR_PRESETS.horizonColor, this.worldSaturation);
      this.ground.fillColor = mixColor(COLOR_PRESETS.groundGray, COLOR_PRESETS.groundColor, this.worldSaturation);

      this.parallaxItems.forEach((item) => {
        item.visualParts.body.fillColor = mixColor(item.grayColor, item.baseColor, this.worldSaturation);
        item.visualParts.roof.fillColor = mixColor(item.roofGrayColor, item.roofBaseColor, this.worldSaturation);
      });

      this.groundLines.forEach((line) => {
        line.fillColor = mixColor(line.grayColor, line.baseColor, this.worldSaturation);
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
        const tint = mixColor(powerUp.grayColor || 0xffffff, powerUp.baseColor || COLOR_PRESETS.powerColor, this.worldSaturation);
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

      this.skyTop.setSize(gameSize.width, gameSize.height * 0.56);
      this.skyBottom.setPosition(0, gameSize.height * 0.56).setSize(gameSize.width, gameSize.height * 0.24);
      this.horizonBand.setPosition(0, gameSize.height * 0.48).setSize(gameSize.width, gameSize.height * 0.18);
      this.ground.setPosition(0, gameSize.height - this.layout.floorHeight).setSize(gameSize.width, this.layout.floorHeight);

      this.parallaxItems.forEach((item, index) => {
        if (item.visualParts.body.width > 100) {
          item.x = (gameSize.width / 5) * index + Phaser.Math.Between(40, 120);
          item.y = gameSize.height - this.layout.floorHeight + 4;
          item.visualParts.body.width = Phaser.Math.Between(110, 150);
          item.visualParts.roof.width = item.visualParts.body.width - 14;
        } else {
          item.x = (gameSize.width / 6) * index + Phaser.Math.Between(40, 110);
          item.y = gameSize.height - this.layout.floorHeight + 2;
          item.visualParts.body.width = Phaser.Math.Between(72, 110);
        }
      });

      this.groundLines.forEach((line, index) => {
        line.x = (gameSize.width / this.groundLines.length) * index;
        line.y = gameSize.height - Math.round(this.layout.floorHeight * 0.46);
      });

      this.sparkles.forEach((sparkle) => {
        sparkle.baseX = Phaser.Math.Between(40, gameSize.width - 40);
        sparkle.baseY = Phaser.Math.Between(50, Math.max(90, gameSize.height * 0.52));
        sparkle.x = sparkle.baseX;
        sparkle.y = sparkle.baseY;
      });

      this.player.x = this.layout.playerStartX;
      this.player.y = Phaser.Math.Clamp(this.player.y || this.layout.centerY, 110, gameSize.height - this.layout.floorHeight - 84);

      const desiredWidth = Phaser.Math.Clamp(this.layout.width * 0.11, 76, 108);
      this.player.setScale(desiredWidth / this.player.width);
      this.player.body.setSize(this.player.displayWidth * 0.56, this.player.displayHeight * 0.62, true);
      this.player.body.setOffset(this.player.displayWidth * 0.24, this.player.displayHeight * 0.2);

      this.hud.layout(this.layout);
      this.phaseBanner.setPosition(this.layout.centerX, this.layout.height * 0.33);
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
      this.updateTail(time);
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

      this.parallaxItems.forEach((item) => {
        item.x -= this.currentPhaseConfig[item.speedKey] * deltaSeconds;
        if (item.visualParts.body.width > 100) {
          item.y = this.layout.height - this.layout.floorHeight + 4;
        } else {
          item.y = this.layout.height - this.layout.floorHeight + 2;
        }

        const halfWidth = item.visualParts.body.width * 0.5;
        if (item.x < -halfWidth - 40) {
          item.x = this.layout.width + halfWidth + Phaser.Math.Between(50, 140);
        }
      });

      this.groundLines.forEach((line) => {
        line.x -= (this.currentPhaseConfig.parallaxNear + 40) * deltaSeconds;
        line.y = this.layout.height - Math.round(this.layout.floorHeight * 0.46);
        if (line.x < -(line.width * 0.5) - 20) {
          line.x = this.layout.width + Phaser.Math.Between(30, 110);
        }
      });

      this.sparkles.forEach((sparkle, index) => {
        sparkle.alpha = 0.2 + (0.4 * ((Math.sin((time * 0.003) + sparkle.twinkleOffset + index) + 1) * 0.5));
        sparkle.x -= this.currentPhaseConfig.parallaxFar * 0.18 * deltaSeconds * sparkle.speedFactor;
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

    updateTail(time) {
      const tailX = this.player.x - (this.player.displayWidth * 0.30);
      const tailY = this.player.y + 2;

      if (this.tailSprite) {
        this.tailSprite.setPosition(tailX, tailY);
        this.tailSprite.setDisplaySize(
          Phaser.Math.Clamp(this.layout.width * 0.23, 120, 240),
          Phaser.Math.Clamp(this.player.displayHeight * 0.95, 30, 58)
        );
        this.tailSprite.setAngle(this.player.angle * 0.22);

        const pipeline = this.tailSprite.pipeline;
        if (pipeline) {
          pipeline.set1f("uTime", time);
          pipeline.set1f("uAlpha", this.gameFinished ? 0.55 : 1.0);
        }
      } else if (this.tailFallback) {
        this.tailHistory.unshift({ x: tailX, y: tailY });
        if (this.tailHistory.length > 16) {
          this.tailHistory.length = 16;
        }

        this.tailFallback.clear();
        if (this.tailHistory.length < 3) {
          return;
        }

        for (let stripe = 0; stripe < RAINBOW_COLORS.length; stripe += 1) {
          this.tailFallback.lineStyle(4, RAINBOW_COLORS[stripe], 0.68);
          this.tailFallback.beginPath();
          this.tailHistory.forEach((point, index) => {
            const x = point.x - (index * 9);
            const y = point.y + ((stripe - (RAINBOW_COLORS.length * 0.5)) * 2.5) + (Math.sin((time * 0.005) + index) * 1.4);
            if (index === 0) {
              this.tailFallback.moveTo(x, y);
            } else {
              this.tailFallback.lineTo(x, y);
            }
          });
          this.tailFallback.strokePath();
        }
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
      const uiTint = mixColor(COLOR_PRESETS.uiGray, COLOR_PRESETS.uiColor, this.worldSaturation);

      this.hud.update({
        phase: this.currentPhaseConfig.number,
        timeLeft,
        score: this.score,
        extraLives: this.extraLives,
        powerUpsCollected: this.powerUpsCollectedThisPhase,
        powerUpsLimit: 3,
        audioLabel: this.cache.audio.exists(this.currentPhaseConfig.audioKey)
          ? `Trilha: ${this.currentPhaseConfig.audioStyle}`
          : `Audio local: ${this.currentPhaseConfig.audioStyle}`,
        panelTint: mixColor(COLOR_PRESETS.panelGray, COLOR_PRESETS.panelColor, this.worldSaturation),
        uiTint
      });
    }
  }

  class GameOverScene extends Phaser.Scene {
    constructor() {
      super("GameOverScene");
    }

    create(data) {
      this.cameras.main.setBackgroundColor("#111827");

      this.add.text(this.scale.width * 0.5, 120, "Game Over", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#f9fafb",
        stroke: "#7f1d1d",
        strokeThickness: 8
      }).setOrigin(0.5);

      this.add.text(this.scale.width * 0.5, 220, [
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

      const hero = this.add.image(this.scale.width * 0.5, 360, "muda-player").setAngle(-12);
      hero.setScale(2.6);

      this.add.text(this.scale.width * 0.5, this.scale.height - 140, "Toque, clique ou pressione ESPACO para tentar novamente.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fde68a",
        align: "center"
      }).setOrigin(0.5);

      this.add.text(this.scale.width * 0.5, this.scale.height - 96, "Rollback pronto em game_v2_backup.js.", {
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
      const centerX = this.scale.width * 0.5;

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

      const hero = this.add.image(centerX, 360, "muda-player");
      hero.setScale(3.1);

      if (this.game.renderer.type === Phaser.WEBGL) {
        const trail = this.add.image(centerX - 16, 364, "trail-strip").setOrigin(1, 0.5).setDepth(hero.depth - 1);
        trail.setDisplaySize(220, 52);
        trail.setBlendMode(Phaser.BlendModes.ADD);
        trail.setPipeline("MudaRainbowTrail");
        if (trail.pipeline) {
          trail.pipeline.set1f("uTime", this.time.now);
          trail.pipeline.set1f("uAlpha", 1.0);
        }
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
        gravity: { y: 940 },
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, WinScene]
  };

  window.MudaGame = new Phaser.Game(gameConfig);
})();
