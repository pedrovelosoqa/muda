/*
  Muda - Versao visual v11

  Teste local:
  - Esta versao continua pronta para abrir direto pelo index.html.
  - Se o navegador bloquear PNGs ou audios no protocolo file://, use Live Server.

  Rollback:
  - As versoes anteriores continuam preservadas na pasta backups/ e em game_v10_gatinha_pura.js.
  - Esta iteracao com a chave muda_final foi salva separadamente em game_v11_muda_final.js.
*/

(() => {
  const GAME_VERSION = "v11_muda_final";
  const PLAYER_TEXTURE_KEY = "muda_final";
  const EXTRA_LIFE_TEXTURE_KEY = "extra-life-treat";
  const RAT_TEXTURE_KEY = "rat-enemy";
  const RAT_RUNTIME_TEXTURE_KEY = "rat-enemy-runtime";
  const RAT_FALLBACK_TEXTURE_KEY = "rat-enemy-fallback";
  const INVINCIBILITY_DURATION = 3000;
  const TOTAL_PHASES = 7;
  const RAT_PHASE_START = 2;
  const RAT_PHASE_END = 4;
  const MAX_RATS_PER_PHASE = 2;
  const POWERUP_SPAWN_MARKERS = [0.22, 0.55, 0.82];
  const EXTRA_LIFE_SPAWN_MARKER_MIN = 0.2;
  const EXTRA_LIFE_SPAWN_MARKER_MAX = 0.78;
  const LOCAL_STORAGE_KEY = "muda-best-score";
  const FIXED_PIPE_GAP = 252;
  const STARTING_LIVES = 7;
  const MAX_LIVES = STARTING_LIVES + TOTAL_PHASES;
  const HUD_ROOT_X = 16;
  const HUD_ROOT_Y = 14;
  const LIFE_ICONS_PER_ROW = 7;
  const LIFE_ICONS_PER_ROW_COMPACT = 5;
  const LIFE_PANEL_RIGHT_MARGIN = 18;
  const EXTRA_LIFE_TEXTURE_FALLBACK_ASPECT = 442 / 626;
  const PHASES = Array.from({ length: TOTAL_PHASES }, (_, index) => {
    const phaseNumber = index + 1;
    const speedFactor = Number(Math.pow(1.15, index).toFixed(4));

    return {
      number: phaseNumber,
      duration: 30 + (index * 10),
      speedFactor,
      obstacleSpeed: Math.round(128 * speedFactor),
      spawnDelay: Math.max(1540, Math.round(2860 / Math.pow(1.05, index))),
      powerUpSpeed: Math.round(120 * speedFactor),
      parallaxCloud: 10 * speedFactor,
      parallaxFar: 21 * speedFactor,
      parallaxNear: 48 * speedFactor,
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

  function safeResumeAudioContext(audioContext) {
    if (!audioContext || audioContext.state !== "suspended" || typeof audioContext.resume !== "function") {
      return;
    }

    audioContext.resume().catch(() => {});
  }

  class AssetBuilder {
    static addImageTexture(scene, key, image) {
      if (!image || !image.complete || image.naturalWidth === 0) {
        return false;
      }

      if (scene.textures.exists(key)) {
        return true;
      }

      scene.textures.addImage(key, image);
      return scene.textures.exists(key);
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

    static generateTexture(scene, key, width, height, drawCallback) {
      if (scene.textures.exists(key)) {
        return;
      }

      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      drawCallback(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    }

    static generateCanvasTexture(scene, key, width, height, drawCallback) {
      if (scene.textures.exists(key)) {
        return;
      }

      const canvasTexture = scene.textures.createCanvas(key, width, height);
      const context = canvasTexture.context;

      context.clearRect(0, 0, width, height);
      drawCallback(context, width, height);
      canvasTexture.refresh();
    }

    static drawCatSilhouette(context, x, y, scale = 1) {
      context.save();
      context.translate(x, y);
      context.scale(scale, scale);
      context.strokeStyle = context.fillStyle;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.beginPath();
      context.ellipse(18, 18, 15, 9, 0, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(33, 11, 7, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.moveTo(28, 8);
      context.lineTo(31, 0);
      context.lineTo(34, 8);
      context.closePath();
      context.fill();

      context.beginPath();
      context.moveTo(34, 8);
      context.lineTo(38, 0);
      context.lineTo(40, 8);
      context.closePath();
      context.fill();

      context.fillRect(15, 24, 3, 8);
      context.fillRect(23, 24, 3, 8);
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(8, 19);
      context.quadraticCurveTo(-5, 5, 4, -2);
      context.stroke();
      context.restore();
    }

    static drawDogSilhouette(context, x, y, scale = 1) {
      context.save();
      context.translate(x, y);
      context.scale(scale, scale);
      context.strokeStyle = context.fillStyle;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.beginPath();
      context.ellipse(20, 18, 16, 9, 0, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(38, 13, 8, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.moveTo(36, 8);
      context.lineTo(43, 3);
      context.lineTo(40, 14);
      context.closePath();
      context.fill();

      context.fillRect(13, 24, 3, 9);
      context.fillRect(24, 24, 3, 9);
      context.fillRect(40, 24, 3, 9);
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(5, 16);
      context.quadraticCurveTo(-5, 8, 2, 0);
      context.stroke();
      context.restore();
    }

    static createUrbanStripTextures(scene) {
      this.generateCanvasTexture(scene, "urban-far-strip", 640, 240, (context, width, height) => {
        const buildings = [
          { x: 0, width: 76, height: 112, windowsX: 3, windowsY: 5, roof: "flat" },
          { x: 58, width: 88, height: 162, windowsX: 4, windowsY: 7, roof: "antenna" },
          { x: 132, width: 72, height: 132, windowsX: 3, windowsY: 5, roof: "water" },
          { x: 192, width: 96, height: 182, windowsX: 4, windowsY: 8, roof: "flat" },
          { x: 272, width: 74, height: 124, windowsX: 3, windowsY: 5, roof: "antenna" },
          { x: 332, width: 82, height: 154, windowsX: 4, windowsY: 6, roof: "water" },
          { x: 398, width: 98, height: 174, windowsX: 4, windowsY: 8, roof: "antenna" },
          { x: 482, width: 76, height: 118, windowsX: 3, windowsY: 5, roof: "flat" },
          { x: 544, width: 96, height: 146, windowsX: 4, windowsY: 6, roof: "water" }
        ];

        buildings.forEach((building, index) => {
          const topY = height - building.height;

          context.fillStyle = index % 2 === 0
            ? "rgba(255,255,255,0.90)"
            : "rgba(255,255,255,0.82)";
          context.fillRect(building.x, topY, building.width, building.height);
          context.fillRect(building.x - 4, topY + 20, building.width + 8, 4);

          if (building.roof === "antenna") {
            context.fillRect(building.x + Math.round(building.width * 0.46), topY - 18, 4, 18);
            context.fillRect(building.x + Math.round(building.width * 0.46) - 6, topY - 10, 16, 3);
          } else if (building.roof === "water") {
            context.fillRect(building.x + Math.round(building.width * 0.56), topY - 18, 20, 18);
            context.fillRect(building.x + Math.round(building.width * 0.56) - 4, topY - 22, 28, 5);
          } else {
            context.fillRect(building.x + 8, topY - 8, building.width - 16, 8);
          }

          context.fillStyle = "rgba(12,18,32,0.28)";
          const gapX = Math.round(building.width / (building.windowsX + 1));
          const gapY = Math.round((building.height - 24) / (building.windowsY + 1));
          for (let row = 0; row < building.windowsY; row += 1) {
            for (let column = 0; column < building.windowsX; column += 1) {
              context.fillRect(
                building.x + 10 + (column * gapX),
                topY + 18 + (row * gapY),
                8,
                12
              );
            }
          }
        });

        context.fillStyle = "rgba(10,14,25,0.62)";
        this.drawCatSilhouette(context, 112, height - 150, 0.88);
        this.drawDogSilhouette(context, 346, height - 118, 0.8);
        this.drawCatSilhouette(context, 566, height - 132, 0.76);
      });

      this.generateCanvasTexture(scene, "urban-near-strip", 640, 208, (context, width, height) => {
        const houses = [
          { x: 0, width: 126, bodyHeight: 86, roofHeight: 34, windows: 2, chimney: true },
          { x: 108, width: 104, bodyHeight: 76, roofHeight: 28, windows: 2, chimney: false },
          { x: 202, width: 138, bodyHeight: 92, roofHeight: 38, windows: 3, chimney: true },
          { x: 324, width: 110, bodyHeight: 82, roofHeight: 30, windows: 2, chimney: false },
          { x: 420, width: 126, bodyHeight: 78, roofHeight: 34, windows: 2, chimney: true },
          { x: 530, width: 110, bodyHeight: 88, roofHeight: 32, windows: 2, chimney: false }
        ];

        houses.forEach((house, index) => {
          const totalHeight = house.bodyHeight + house.roofHeight;
          const topY = height - totalHeight;
          const bodyY = topY + house.roofHeight;

          context.fillStyle = index % 2 === 0
            ? "rgba(255,255,255,0.97)"
            : "rgba(255,255,255,0.88)";
          context.fillRect(house.x, bodyY, house.width, house.bodyHeight);

          context.beginPath();
          context.moveTo(house.x - 8, bodyY);
          context.lineTo(house.x + Math.round(house.width * 0.5), topY);
          context.lineTo(house.x + house.width + 8, bodyY);
          context.closePath();
          context.fillStyle = "rgba(255,255,255,0.78)";
          context.fill();

          if (house.chimney) {
            context.fillStyle = "rgba(255,255,255,0.68)";
            context.fillRect(house.x + house.width - 28, topY + 10, 12, 24);
          }

          context.fillStyle = "rgba(12,18,32,0.30)";
          const windowGap = Math.round(house.width / (house.windows + 1));
          for (let indexWindow = 0; indexWindow < house.windows; indexWindow += 1) {
            context.fillRect(house.x + 16 + (indexWindow * windowGap), bodyY + 18, 14, 18);
            context.fillRect(house.x + 16 + (indexWindow * windowGap), bodyY + 46, 14, 18);
          }
          context.fillRect(house.x + Math.round(house.width * 0.42), bodyY + 38, 18, house.bodyHeight - 38);
        });

        context.fillStyle = "rgba(8,12,22,0.66)";
        this.drawCatSilhouette(context, 70, height - 128, 0.84);
        this.drawCatSilhouette(context, 258, height - 144, 0.72);
        this.drawDogSilhouette(context, 462, height - 122, 0.78);
      });

      this.generateCanvasTexture(scene, "urban-wall-strip", 640, 128, (context, width, height) => {
        context.fillStyle = "rgba(255,255,255,0.92)";
        context.fillRect(0, 42, width, 72);
        context.fillRect(0, 36, width, 8);

        for (let x = 0; x <= width; x += 80) {
          context.fillRect(x, 24, 18, 90);
          context.fillRect(x - 6, 18, 30, 10);
        }

        context.fillStyle = "rgba(15,23,42,0.16)";
        for (let row = 0; row < 4; row += 1) {
          const brickY = 54 + (row * 14);
          context.fillRect(0, brickY, width, 3);
          for (let column = 0; column < 8; column += 1) {
            context.fillRect((column * 80) + ((row % 2) * 16), brickY - 6, 3, 12);
          }
        }

        context.fillStyle = "rgba(255,255,255,0.74)";
        context.fillRect(214, 48, 66, 66);
        context.fillRect(360, 48, 82, 66);
        context.fillStyle = "rgba(15,23,42,0.28)";
        context.fillRect(226, 60, 42, 54);
        context.fillRect(376, 60, 18, 54);
        context.fillRect(408, 60, 18, 54);

        context.fillStyle = "rgba(8,12,22,0.74)";
        this.drawDogSilhouette(context, 84, height - 40, 0.86);
        this.drawCatSilhouette(context, 292, height - 34, 0.76);
        this.drawDogSilhouette(context, 520, height - 42, 0.72);
      });
    }

    static createFallbackTextures(scene) {
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

      this.createUrbanStripTextures(scene);
    }

    static createCleanRatTexture(scene) {
      if (!scene.textures.exists(RAT_TEXTURE_KEY) || scene.textures.exists(RAT_RUNTIME_TEXTURE_KEY)) {
        return false;
      }

      if (!window.document || (window.location && window.location.protocol === "file:")) {
        return false;
      }

      try {
        const sourceTexture = scene.textures.get(RAT_TEXTURE_KEY);
        const sourceImage = sourceTexture && sourceTexture.getSourceImage ? sourceTexture.getSourceImage() : null;
        if (!sourceImage || !sourceImage.width || !sourceImage.height) {
          return false;
        }

        const workingCanvas = window.document.createElement("canvas");
        workingCanvas.width = sourceImage.width;
        workingCanvas.height = sourceImage.height;

        const workingContext = workingCanvas.getContext("2d");
        if (!workingContext) {
          return false;
        }

        workingContext.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
        workingContext.drawImage(sourceImage, 0, 0);

        const imageData = workingContext.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
        const { data, width, height } = imageData;
        const quantizeStep = 12;
        const paletteBins = new Map();
        const sampleInset = Math.max(1, Math.round(Math.min(width, height) * 0.018));
        const sampleStep = Math.max(3, Math.round(Math.min(width, height) / 160));

        const quantizeChannel = (value) => Math.max(0, Math.min(255, Math.round(value / quantizeStep) * quantizeStep));
        const collectBorderColor = (x, y) => {
          const index = ((y * width) + x) * 4;
          if (data[index + 3] < 12) {
            return;
          }

          const key = [
            quantizeChannel(data[index]),
            quantizeChannel(data[index + 1]),
            quantizeChannel(data[index + 2])
          ].join(",");

          paletteBins.set(key, (paletteBins.get(key) || 0) + 1);
        };

        for (let x = 0; x < width; x += sampleStep) {
          collectBorderColor(x, sampleInset);
          collectBorderColor(x, Math.max(0, height - 1 - sampleInset));
        }

        for (let y = 0; y < height; y += sampleStep) {
          collectBorderColor(sampleInset, y);
          collectBorderColor(Math.max(0, width - 1 - sampleInset), y);
        }

        const palette = [...paletteBins.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 24)
          .map(([key]) => key.split(",").map(Number));

        if (palette.length === 0) {
          return false;
        }

        const transparentDistanceSq = 28 * 28;
        const featherDistanceSq = 62 * 62;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = ((y * width) + x) * 4;
            const alpha = data[index + 3];
            if (alpha < 12) {
              continue;
            }

            const red = data[index];
            const green = data[index + 1];
            const blue = data[index + 2];
            let nearestDistanceSq = Number.POSITIVE_INFINITY;

            for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
              const [sampleRed, sampleGreen, sampleBlue] = palette[paletteIndex];
              const distanceSq =
                ((red - sampleRed) * (red - sampleRed)) +
                ((green - sampleGreen) * (green - sampleGreen)) +
                ((blue - sampleBlue) * (blue - sampleBlue));

              if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
              }
            }

            if (nearestDistanceSq <= transparentDistanceSq) {
              data[index + 3] = 0;
              continue;
            }

            if (nearestDistanceSq < featherDistanceSq) {
              const alphaFactor = (nearestDistanceSq - transparentDistanceSq) / (featherDistanceSq - transparentDistanceSq);
              data[index + 3] = Math.min(alpha, Math.round(255 * alphaFactor));
            }

            if (data[index + 3] > 16) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          return false;
        }

        workingContext.putImageData(imageData, 0, 0);

        const padding = 8;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(width - cropX, (maxX - minX + 1) + (padding * 2));
        const cropHeight = Math.min(height - cropY, (maxY - minY + 1) + (padding * 2));
        const canvasTexture = scene.textures.createCanvas(RAT_RUNTIME_TEXTURE_KEY, cropWidth, cropHeight);
        const canvasContext = canvasTexture.context;

        canvasContext.clearRect(0, 0, cropWidth, cropHeight);
        canvasContext.drawImage(
          workingCanvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );
        canvasTexture.refresh();
        return true;
      } catch (error) {
        console.warn("Nao foi possivel preparar a textura limpa do rato.", error);
        return false;
      }
    }

    static createRatFallbackTexture(scene) {
      try {
        this.generateCanvasTexture(scene, RAT_FALLBACK_TEXTURE_KEY, 132, 84, (context) => {
          const fillTriangle = (x1, y1, x2, y2, x3, y3) => {
            context.beginPath();
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.lineTo(x3, y3);
            context.closePath();
            context.fill();
          };

          context.fillStyle = "#3b3d42";
          context.beginPath();
          context.ellipse(62, 46, 33, 17, 0, 0, Math.PI * 2);
          context.fill();

          context.beginPath();
          context.ellipse(92, 38, 14, 12, 0, 0, Math.PI * 2);
          context.fill();

          fillTriangle(85, 28, 92, 12, 96, 30);
          fillTriangle(96, 30, 106, 14, 108, 33);

          context.fillStyle = "#5a5f67";
          context.beginPath();
          context.ellipse(54, 42, 14, 8, 0, 0, Math.PI * 2);
          context.fill();

          context.fillStyle = "#1f2125";
          context.fillRect(44, 58, 7, 18);
          context.fillRect(66, 58, 7, 18);
          context.fillRect(90, 58, 7, 16);

          context.beginPath();
          context.arc(100, 36, 2, 0, Math.PI * 2);
          context.fill();

          context.strokeStyle = "#2d2f34";
          context.lineWidth = 5;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(28, 44);
          context.quadraticCurveTo(10, 24, 8, 54);
          context.stroke();
        });
      } catch (error) {
        console.warn("Nao foi possivel preparar a textura fallback do rato.", error);
      }
    }

    static ensureRuntimeTextures(scene) {
      if (scene.textures.exists("ui-source")) {
        this.cropTexture(scene, "ui-source", "hud-cat-icon", CROPS.hudCat);
        this.cropTexture(scene, "ui-source", "hud-cat-icon-alt", CROPS.hudCatAlt);
      }

      if (scene.textures.exists("power-source")) {
        this.cropTexture(scene, "power-source", "power-treat", CROPS.powerTreat);
        this.cropTexture(scene, "power-source", "power-toy", CROPS.powerToy);
      }

      this.createFallbackTextures(scene);
      this.createCleanRatTexture(scene);
      this.createRatFallbackTexture(scene);
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
      this.lifeTitle = this.createText("Vidas", 16, "#ffffff", "bold");
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

    getLivesLayout(width) {
      const compact = width <= 420;
      const iconWidth = compact ? 22 : 24;
      const iconHeight = compact ? 15 : 16;
      const columnGap = compact ? 2 : 3;
      const rowGap = compact ? 20 : 22;
      const iconsPerRow = compact ? LIFE_ICONS_PER_ROW_COMPACT : LIFE_ICONS_PER_ROW;
      const count = Math.max(0, this.lastLivesCount);
      const rowCount = Math.max(1, Math.ceil(Math.max(1, count) / iconsPerRow));
      const widestRowCount = Math.min(Math.max(1, count), iconsPerRow);
      const widestRowWidth = (widestRowCount * iconWidth) + (Math.max(0, widestRowCount - 1) * columnGap);
      const panelWidth = Math.max(this.lifeTitle.width, widestRowWidth);
      const availableWidth = Math.max(0, width - HUD_ROOT_X);
      const panelLeft = Math.max(0, availableWidth - LIFE_PANEL_RIGHT_MARGIN - panelWidth);
      const bottomIconsY = 34 + ((rowCount - 1) * rowGap) + iconHeight;

      return {
        iconWidth,
        iconHeight,
        columnGap,
        rowGap,
        rowCount,
        iconsPerRow,
        panelWidth,
        panelLeft,
        titleX: panelLeft + ((panelWidth - this.lifeTitle.width) * 0.5),
        firstRowY: 34,
        audioTextY: Math.max(82, bottomIconsY + 10)
      };
    }

    layout(bounds) {
      this.root.setPosition(HUD_ROOT_X, HUD_ROOT_Y);
      this.phaseText.setPosition(0, 0);
      this.timeText.setPosition(0, 28);
      this.scoreIcon.setPosition(0, 62);
      this.scoreIcon.setDisplaySize(26, 16);
      this.scoreText.setPosition(34, 50);

      const lifeLayout = this.getLivesLayout(bounds.width);
      this.audioText.setPosition(0, lifeLayout.audioTextY);
      this.lifeTitle.setPosition(lifeLayout.titleX, 0);
      this.reflowLives(this.lastLivesCount > -1 ? this.lastLivesCount : 0, bounds.width);
    }

    reflowLives(count, width) {
      this.lifeIcons.forEach((icon) => icon.destroy());
      this.lifeIcons = [];

      this.lastLivesCount = Phaser.Math.Clamp(count, 0, MAX_LIVES);
      const lifeLayout = this.getLivesLayout(width);
      const maxIcons = this.lastLivesCount;

      this.audioText.setPosition(0, lifeLayout.audioTextY);
      this.lifeTitle.setPosition(lifeLayout.titleX, 0);

      for (let index = 0; index < maxIcons; index += 1) {
        const rowIndex = Math.floor(index / lifeLayout.iconsPerRow);
        const indexInRow = index % lifeLayout.iconsPerRow;
        const rowStartIndex = rowIndex * lifeLayout.iconsPerRow;
        const rowCount = Math.min(lifeLayout.iconsPerRow, maxIcons - rowStartIndex);
        const rowWidth = (rowCount * lifeLayout.iconWidth) + (Math.max(0, rowCount - 1) * lifeLayout.columnGap);
        const rowLeft = lifeLayout.panelLeft + ((lifeLayout.panelWidth - rowWidth) * 0.5);
        const x = rowLeft + (lifeLayout.iconWidth * 0.5) + (indexInRow * (lifeLayout.iconWidth + lifeLayout.columnGap));
        const y = lifeLayout.firstRowY + (rowIndex * lifeLayout.rowGap);
        const icon = this.scene.add.image(x, y, PLAYER_TEXTURE_KEY).setOrigin(0.5);
        icon.setDisplaySize(lifeLayout.iconWidth, lifeLayout.iconHeight);
        this.lifeIcons.push(icon);
        this.root.add(icon);
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
      }

      if (!this.damageFlashActive) {
        this.lifeTitle.setAlpha(1);
        this.lifeIcons.forEach((icon) => {
          icon.setAlpha(1);
        });
      }
    }

    flashDamage() {
      if (this.damageTween) {
        this.damageTween.stop();
      }

      this.damageFlashActive = true;
      this.lifeTitle.setAlpha(0.5);
      this.lifeIcons.forEach((icon) => {
        icon.setAlpha(0.5);
      });

      this.damageTween = this.scene.tweens.add({
        targets: [this.lifeTitle, ...this.lifeIcons],
        alpha: 0.25,
        duration: 120,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.damageFlashActive = false;
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
      this.pipeStyles = [
        { name: "yellow", fill: 0xfacc15 },
        { name: "green", fill: 0x84f31c },
        { name: "red", fill: 0xff5a36 }
      ];
    }

    spawn(config) {
      const { width, height, floorHeight } = this.scene.layout;
      const floorTop = height - floorHeight;
      const minPipeHeight = Math.max(64, Math.round(height * 0.1));
      const maxGapSize = floorTop - (minPipeHeight * 2);
      const gapSize = Math.min(FIXED_PIPE_GAP, maxGapSize);
      const minCenter = Math.round(minPipeHeight + (gapSize * 0.5));
      const maxCenter = Math.round(floorTop - minPipeHeight - (gapSize * 0.5));
      const previousCenter = this.scene.lastGapCenterY || Math.round((minCenter + maxCenter) * 0.5);
      const maxGapShift = Math.max(34, Math.round(height * 0.06));
      const limitedMin = Phaser.Math.Clamp(previousCenter - maxGapShift, minCenter, maxCenter);
      const limitedMax = Phaser.Math.Clamp(previousCenter + maxGapShift, minCenter, maxCenter);
      const centerY = Phaser.Math.Between(
        Math.min(limitedMin, limitedMax),
        Math.max(limitedMin, limitedMax)
      );
      const obstacleWidth = Phaser.Math.Clamp(Math.round(width * 0.14), 74, 118);
      const spawnX = width + obstacleWidth;
      const gapTopY = Math.round(centerY - (gapSize * 0.5));
      const gapBottomY = Math.round(centerY + (gapSize * 0.5));
      const topHeight = Math.max(minPipeHeight, gapTopY);
      const bottomHeight = Math.max(minPipeHeight, floorTop - gapBottomY);
      this.scene.lastGapCenterY = centerY;
      const pipeStyle = Phaser.Utils.Array.GetRandom(this.pipeStyles);

      const pieces = [
        this.createPipePiece({
          x: spawnX,
          y: 0,
          width: obstacleWidth,
          height: topHeight,
          originY: 0,
          speed: config.obstacleSpeed,
          isTop: true,
          pipeStyle
        }),
        this.createPipePiece({
          x: spawnX,
          y: floorTop,
          width: obstacleWidth,
          height: bottomHeight,
          originY: 1,
          speed: config.obstacleSpeed,
          isTop: false,
          pipeStyle
        })
      ];

      const set = {
        id: this.serial += 1,
        type: "pipe",
        pieces,
        gapTopY,
        gapBottomY,
        gapCenterY: centerY,
        spawnX,
        speed: config.obstacleSpeed,
        scored: false
      };

      pieces.forEach((piece) => piece.setData("obstacleSetId", set.id));
      return set;
    }

    ensurePipeTexture(width, height, isTop, pipeStyle) {
      const orientation = isTop ? "top" : "bottom";
      const textureKey = `${pipeStyle.name}-pipe-${orientation}-${width}x${height}`;
      if (this.scene.textures.exists(textureKey)) {
        return textureKey;
      }

      const graphics = this.scene.add.graphics();
      const pipeColor = pipeStyle.fill;
      const strokeColor = 0x000000;
      const strokeWidth = 2;
      const lipHeight = Math.max(18, Math.min(28, Math.round(height * 0.1)));
      const bodyWidth = Math.max(22, Math.round(width * 0.68));
      const bodyX = Math.round((width - bodyWidth) * 0.5);
      const bodyHeight = Math.max(0, height - lipHeight);

      graphics.fillStyle(pipeColor, 1);
      graphics.lineStyle(strokeWidth, strokeColor, 1);

      if (isTop) {
        graphics.fillRect(bodyX, 0, bodyWidth, bodyHeight);
        graphics.strokeRect(bodyX, 0, bodyWidth, bodyHeight);
        graphics.fillRect(0, bodyHeight, width, lipHeight);
        graphics.strokeRect(0, bodyHeight, width, lipHeight);
      } else {
        graphics.fillRect(0, 0, width, lipHeight);
        graphics.strokeRect(0, 0, width, lipHeight);
        graphics.fillRect(bodyX, lipHeight, bodyWidth, bodyHeight);
        graphics.strokeRect(bodyX, lipHeight, bodyWidth, bodyHeight);
      }

      graphics.generateTexture(textureKey, width, height);
      graphics.destroy();
      return textureKey;
    }

    createPipePiece(config) {
      const textureKey = this.ensurePipeTexture(config.width, config.height, config.isTop, config.pipeStyle);
      const piece = this.group.create(config.x, config.y, textureKey);
      piece.setOrigin(0.5, config.originY);
      piece.setDisplaySize(config.width, config.height);

      piece.setActive(true);
      piece.setVisible(true);
      piece.setDepth(34);
      piece.obstacleType = "pipe";
      piece.usesYellowPipeArt = true;

      piece.body.setAllowGravity(false);
      piece.body.moves = true;
      piece.body.setImmovable(true);
      piece.body.setVelocityX(-config.speed);
      piece.body.setSize(config.width * 0.85, config.height * 0.98);
      piece.body.setOffset(config.width * 0.075, 0);

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

      this.load.image(PLAYER_TEXTURE_KEY, "./gatinha_frame.png");
      this.load.image(EXTRA_LIFE_TEXTURE_KEY, "./petisco_clean.png");
      this.load.image(RAT_TEXTURE_KEY, "./rato.png");
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
      const finishBoot = () => {
        if (this.bootFinished) {
          return;
        }

        this.bootFinished = true;
        try {
          AssetBuilder.ensureRuntimeTextures(this);
        } catch (error) {
          console.warn("Falha ao preparar texturas runtime; seguindo com o boot.", error);
        }
        this.registry.set("failedAssets", Array.from(this.failedAssets));
        this.registry.set("gameVersion", GAME_VERSION);
        this.scene.start("MenuScene");
      };

      const requiredImages = [
        { key: PLAYER_TEXTURE_KEY, src: "./gatinha_frame.png" },
        { key: EXTRA_LIFE_TEXTURE_KEY, src: "./petisco_clean.png" },
        { key: RAT_TEXTURE_KEY, src: "./rato.png" }
      ];
      const missingImages = requiredImages.filter((image) => !this.textures.exists(image.key));

      if (missingImages.length === 0) {
        finishBoot();
        return;
      }

      if (window.location.protocol === "file:") {
        let pendingFallbacks = missingImages.length;
        const concludeFallback = () => {
          pendingFallbacks -= 1;
          if (pendingFallbacks <= 0) {
            finishBoot();
          }
        };

        missingImages.forEach((imageConfig) => {
          const fallbackImage = new Image();
          fallbackImage.onload = () => {
            AssetBuilder.addImageTexture(this, imageConfig.key, fallbackImage);
            concludeFallback();
          };
          fallbackImage.onerror = () => {
            concludeFallback();
          };
          fallbackImage.src = new URL(imageConfig.src, window.location.href).href;
        });
        return;
      }

      finishBoot();
    }
  }

  class MenuScene extends Phaser.Scene {
    constructor() {
      super("MenuScene");
    }

    create() {
      this.layout = getLayout(this.scale.width, this.scale.height);
      this.clouds = [];
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
      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.18, 112, 180);
      this.heroPlayer = new window.MudaPlayer(this, {
        x: this.layout.centerX,
        y: this.layout.centerY + 16,
        textureKey: PLAYER_TEXTURE_KEY,
        enablePhysics: false,
        depth: 24,
        displayWidth: targetWidth,
        trailLength: 24
      });

      this.tweens.add({
        targets: this.heroPlayer.root,
        y: this.heroPlayer.root.y + 14,
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
      }).setOrigin(0.5).setDepth(12);
      this.title.setShadow(0, 6, "#ffd54f", 0, false, true);
    }

    createPlayButton() {
      this.playButton = this.add.container(0, 0).setDepth(30);
      this.playButtonBg = this.add.rectangle(0, 0, 260, 72, 0xffef9e).setStrokeStyle(4, 0x9a5a16, 1);
      this.playButtonIcon = this.add.image(-82, 0, PLAYER_TEXTURE_KEY).setDisplaySize(34, 22);
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
        "Versao visual: game_v11_muda_final.js | Rollbacks anteriores preservados",
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
      this.scene.start("GameScene", { phaseIndex: 0, score: 0, lives: STARTING_LIVES, extraLives: STARTING_LIVES });
    }

    handleResize(gameSize) {
      this.layout = getLayout(gameSize.width, gameSize.height);
      this.skyTop.setSize(gameSize.width, gameSize.height * 0.6);
      this.skyBottom.setPosition(0, gameSize.height * 0.6).setSize(gameSize.width, gameSize.height * 0.4);
      this.horizon.setPosition(0, gameSize.height * 0.72).setSize(gameSize.width, gameSize.height * 0.16);
      this.ground.setPosition(0, gameSize.height * 0.86).setSize(gameSize.width, gameSize.height * 0.14);

      this.title.setPosition(this.layout.centerX, 94);
      this.heroPlayer.setPosition(this.layout.centerX, this.layout.centerY + 18);
      this.playButton.setPosition(this.layout.centerX, this.layout.height - 160);
      this.footer.setPosition(this.layout.centerX, this.layout.height - 38);

      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.18, 112, 180);
      this.heroPlayer.setDisplayWidth(targetWidth);

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

      const waveVelocity = Math.sin(time * 0.004) * 120;
      this.heroPlayer.setVelocityHint(waveVelocity);
      this.heroPlayer.update(time, waveVelocity);
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() {
      super("GameScene");
    }

    init(data) {
      this.phaseIndex = data.phaseIndex || 0;
      this.score = data.score || 0;
      const initialLives = typeof data.lives === "number"
        ? data.lives
        : (typeof data.extraLives === "number" ? data.extraLives : STARTING_LIVES);
      this.lives = Phaser.Math.Clamp(initialLives, 0, MAX_LIVES);
      this.extraLives = this.lives;
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
      this.lastGapCenterY = null;
      this.extraLifeSpawnedThisPhase = false;
      this.extraLifePendingThisPhase = false;
      this.invincibilityTimer = null;
      this.nextRatSpawnAt = null;
      this.ratsSpawnedThisPhase = 0;
      this.phaseRatTimers = [];

      this.physics.world.gravity.y = 430;
      this.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);

      this.createBackground();
      this.createGroups();
      this.createPlayer();
      this.createHud();
      this.createInput();

      this.obstacleFactory = new ObstacleFactory(this, this.obstacles);

      this.physics.add.overlap(this.playerBody, this.obstacles, this.onPlayerHit, null, this);
      this.physics.add.overlap(this.playerBody, this.powerUps, this.collectPowerUp, null, this);
      this.physics.add.overlap(this.playerBody, this.extraLifeTreats, this.collectExtraLifeTreat, null, this);
      this.physics.add.overlap(this.playerBody, this.rats, this.onRatHit, null, this);

      this.scale.on("resize", this.handleResize, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off("resize", this.handleResize, this);
        this.input.off("pointerdown", this.flap, this);
        this.input.keyboard.off("keydown-SPACE", this.flap, this);
        this.input.keyboard.off("keydown-UP", this.flap, this);
        this.clearInvincibilityState();
        this.stopCurrentMusic();
        this.phaseRatTimers.forEach((timer) => timer.remove(false));
        this.phaseRatTimers = [];
        if (this.player) {
          this.player.destroy();
          this.player = null;
          this.playerBody = null;
        }
      });

      this.startPhase(this.phaseIndex);
      this.handleResize({ width: this.scale.width, height: this.scale.height });
    }

    createBackground() {
      this.skyTop = this.add.rectangle(0, 0, this.scale.width, this.scale.height * 0.58, COLORS.skyTopGray).setOrigin(0).setDepth(0);
      this.skyBottom = this.add.rectangle(0, this.scale.height * 0.58, this.scale.width, this.scale.height * 0.28, COLORS.skyBottomGray).setOrigin(0).setDepth(1);
      this.horizonBand = this.add.rectangle(0, this.scale.height * 0.72, this.scale.width, this.scale.height * 0.14, COLORS.cityGray).setOrigin(0).setDepth(2);
      this.ground = this.add.rectangle(0, this.scale.height - this.layout.floorHeight, this.scale.width, this.layout.floorHeight, COLORS.groundGray).setOrigin(0).setDepth(6);

      this.clouds = [];
      for (let index = 0; index < 7; index += 1) {
        const cloud = this.add.image(0, 0, "cloud-soft").setAlpha(0.78).setDepth(8);
        cloud.grayColor = COLORS.cloudGray;
        cloud.baseColor = COLORS.cloudColor;
        cloud.speedFactor = Phaser.Math.FloatBetween(0.9, 1.35);
        this.clouds.push(cloud);
      }

      this.farSkyline = this.add.tileSprite(0, 0, this.scale.width, 200, "urban-far-strip").setOrigin(0, 1).setDepth(10).setAlpha(0.9);
      this.farSkyline.grayColor = COLORS.cityGray;
      this.farSkyline.baseColor = COLORS.cityColor;

      this.nearHomes = this.add.tileSprite(0, 0, this.scale.width, 184, "urban-near-strip").setOrigin(0, 1).setDepth(14).setAlpha(0.95);
      this.nearHomes.grayColor = COLORS.rooftopGray;
      this.nearHomes.baseColor = COLORS.rooftopColor;

      this.streetWalls = this.add.tileSprite(0, 0, this.scale.width, 92, "urban-wall-strip").setOrigin(0, 1).setDepth(18);
      this.streetWalls.grayColor = COLORS.groundGray;
      this.streetWalls.baseColor = COLORS.groundColor;

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

      this.extraLifeTreats = this.physics.add.group({
        allowGravity: false,
        immovable: true
      });

      this.rats = this.physics.add.group({
        allowGravity: false,
        immovable: true
      });
    }

    createPlayer() {
      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.1, 74, 110);
      this.player = new window.MudaPlayer(this, {
        x: this.layout.playerStartX,
        y: this.layout.centerY,
        textureKey: PLAYER_TEXTURE_KEY,
        enablePhysics: true,
        depth: 30,
        displayWidth: targetWidth,
        trailLength: 28
      });
      this.playerBody = this.player.bodySprite;
      this.playerBody.setDepth(30);
      this.playerBody.body.setMaxVelocity(9999, 470);
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

    isRatPhaseActive() {
      return this.currentPhaseConfig
        && this.currentPhaseConfig.number >= RAT_PHASE_START
        && this.currentPhaseConfig.number <= RAT_PHASE_END;
    }

    scheduleNextRatSpawn() {
      const baseDelay = this.currentPhaseConfig ? this.currentPhaseConfig.spawnDelay : 2600;
      this.nextRatSpawnAt = this.time.now + Phaser.Math.Between(
        Math.round(baseDelay * 1.9),
        Math.round(baseDelay * 2.8)
      );
    }

    schedulePhaseRatSpawns() {
      this.phaseRatTimers.forEach((timer) => timer.remove(false));
      this.phaseRatTimers = [];

      if (!this.isRatPhaseActive() || !this.currentPhaseConfig) {
        return;
      }

      const phaseDurationMs = this.currentPhaseConfig.duration * 1000;
      const baseMarkers = [0.34, 0.72];
      const jitterMs = Math.min(1800, Math.round(phaseDurationMs * 0.045));
      const minDelay = Math.max(3500, Math.round(phaseDurationMs * 0.2));
      const maxDelay = Math.max(minDelay, Math.round(phaseDurationMs * 0.82));

      baseMarkers.slice(0, MAX_RATS_PER_PHASE).forEach((marker) => {
        const rawDelay = Math.round((phaseDurationMs * marker) + Phaser.Math.Between(-jitterMs, jitterMs));
        const delay = Phaser.Math.Clamp(rawDelay, minDelay, maxDelay);
        const timer = this.time.delayedCall(delay, () => {
          if (this.phaseTransitionActive || this.gameFinished || this.isPhaseDurationComplete()) {
            return;
          }

          this.spawnRat();
        });

        this.phaseRatTimers.push(timer);
      });
    }

    spawnRat() {
      try {
        const ratTextureKey = this.textures.exists(RAT_RUNTIME_TEXTURE_KEY)
          ? RAT_RUNTIME_TEXTURE_KEY
          : (this.textures.exists(RAT_FALLBACK_TEXTURE_KEY) ? RAT_FALLBACK_TEXTURE_KEY : RAT_TEXTURE_KEY);

        if (
          !this.rats ||
          !this.textures.exists(ratTextureKey) ||
          !this.currentPhaseConfig ||
          this.ratsSpawnedThisPhase >= MAX_RATS_PER_PHASE
        ) {
          return false;
        }

        const rat = this.rats.create(0, 0, ratTextureKey);
        if (!rat) {
          return false;
        }

          const playerSize = this.player
            ? Math.max(this.player.displayWidth, this.player.displayHeight)
            : Phaser.Math.Clamp(this.layout.width * 0.12, 96, 128);
          const ratHeight = Phaser.Math.Clamp(Math.round(playerSize * 1.18), 108, 148);

          rat.setActive(true);
          rat.setVisible(true);
          rat.setDepth(35);
          rat.setDisplayHeight(ratHeight);

          const minY = Math.max(96, Math.round(this.layout.height * 0.26));
        const maxY = Math.max(
          minY,
          Math.round(this.layout.height - this.layout.floorHeight - Math.max(rat.displayHeight * 0.5, 40))
        );
        const spawnY = Phaser.Math.Between(minY, maxY);

        rat.setPosition(this.layout.width + (rat.displayWidth * 0.5) + 24, spawnY);

        rat.body.setAllowGravity(false);
        rat.body.moves = true;
        rat.body.setImmovable(true);
        rat.body.setVelocityX(-Math.round(this.currentPhaseConfig.obstacleSpeed * 1.04));
        rat.body.setVelocityY(0);
        rat.body.setSize(rat.displayWidth * 0.56, rat.displayHeight * 0.68, true);
        this.ratsSpawnedThisPhase += 1;
        return true;
      } catch (error) {
        console.warn("Falha ao criar rato nesta fase.", error);
        return false;
      }
    }

    clearRats() {
      if (!this.rats) {
        return;
      }

      this.rats.children.each((rat) => {
        if (rat && rat.active) {
          rat.destroy();
        }
      });
    }

    updateRats() {
      if (!this.rats) {
        return;
      }

      if (
        !this.isRatPhaseActive() ||
        this.phaseTransitionActive ||
        this.gameFinished
      ) {
        this.clearRats();
        return;
      }

      this.rats.children.each((rat) => {
        if (!rat.active) {
          return;
        }

        if (rat.x < -((rat.displayWidth || rat.width) + 80)) {
          rat.destroy();
        }
      });
    }

    onRatHit(playerBody, rat) {
      if (!rat || !rat.active) {
        return;
      }

      rat.destroy();
      this.onPlayerHit();
    }

    flap() {
      if (this.phaseTransitionActive || this.gameFinished || !this.player || !this.player.body) {
        return;
      }

      this.player.setVelocityY(-Math.round(Math.max(235, this.layout.height * 0.285)));

      if (this.cache.audio.exists("sfx_flap")) {
        this.sound.play("sfx_flap", { volume: 0.28 });
      }
    }

    isPhaseDurationComplete() {
      if (this.gameFinished || !this.currentPhaseConfig) {
        return false;
      }

      return (this.time.now - this.phaseStartTime) >= (this.currentPhaseConfig.duration * 1000);
    }

    suspendPlayerForTransition() {
      if (!this.playerBody || !this.playerBody.body) {
        return;
      }

      this.player.setVelocityHint(0);
      this.player.setVelocityY(0);
      this.playerBody.setVelocity(0, 0);
      this.playerBody.body.setAllowGravity(false);
      this.playerBody.body.moves = false;
      this.playerBody.body.enable = false;

      if (this.physics.world && !this.physics.world.isPaused) {
        this.physics.world.pause();
      }
    }

    restorePlayerAfterTransition() {
      if (!this.playerBody || !this.playerBody.body) {
        return;
      }

      const safeX = this.layout.playerStartX;
      const floorLimit = this.layout.height - this.layout.floorHeight - 120;
      const safeMaxY = Math.max(112, floorLimit);
      const safeY = Phaser.Math.Clamp(this.player.y || this.layout.centerY, 112, safeMaxY);

      this.playerBody.body.enable = true;
      this.playerBody.body.moves = true;
      this.playerBody.body.setAllowGravity(true);

      if (this.playerBody.body.reset) {
        this.playerBody.body.reset(safeX, safeY);
      } else {
        this.playerBody.setPosition(safeX, safeY);
      }

      this.playerBody.setVelocity(0, 0);
      if (this.playerBody.body.updateFromGameObject) {
        this.playerBody.body.updateFromGameObject();
      }

      this.player.setPosition(safeX, safeY);
      this.player.setVelocityHint(0);

      if (this.physics.world && this.physics.world.isPaused) {
        this.physics.world.resume();
      }
    }

    clearPhaseActors() {
      this.obstacles.children.each((obstacle) => {
        if (obstacle && obstacle.active) {
          obstacle.destroy();
        }
      });
      this.obstacleSets = [];

      this.powerUps.children.each((powerUp) => {
        if (powerUp && powerUp.active) {
          powerUp.destroy();
        }
      });

      this.extraLifeTreats.children.each((treat) => {
        if (treat && treat.active) {
          treat.destroy();
        }
      });

      this.clearRats();
    }

    startPhase(index) {
      this.phaseTransitionActive = true;
      this.clearInvincibilityState();
      this.phaseIndex = index;
      this.currentPhaseConfig = PHASES[this.phaseIndex];
      this.phaseStartTime = this.time.now;
      this.phaseElapsedMs = 0;
      this.powerUpsSpawnedThisPhase = 0;
      this.powerUpsCollectedThisPhase = 0;
      this.lastGapCenterY = null;
      this.extraLifeSpawnedThisPhase = false;
      this.extraLifePendingThisPhase = false;
      this.nextRatSpawnAt = null;
      this.ratsSpawnedThisPhase = 0;
      this.phaseRatTimers.forEach((timer) => timer.remove(false));
      this.phaseRatTimers = [];

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];

      this.clearPhaseActors();
      this.restorePlayerAfterTransition();
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

      const extraLifeTimer = this.time.delayedCall(
        Phaser.Math.Between(
          Math.round(this.currentPhaseConfig.duration * EXTRA_LIFE_SPAWN_MARKER_MIN * 1000),
          Math.round(this.currentPhaseConfig.duration * EXTRA_LIFE_SPAWN_MARKER_MAX * 1000)
        ),
        this.triggerExtraLifeTreatSpawn,
        [],
        this
      );
      this.phasePowerUpTimers.push(extraLifeTimer);

      this.updatePhaseBanner(`Fase ${this.currentPhaseConfig.number}`);
      this.syncMusic();
      this.schedulePhaseRatSpawns();
      this.refreshWorldColors(true);
      this.phaseTransitionActive = false;
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

      const minimumSpawnSpacing = Math.max(300, Math.round(this.layout.width * 0.42));
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

      const set = this.obstacleFactory.spawn(this.currentPhaseConfig);
      this.obstacleSets.push(set);

      if (this.extraLifePendingThisPhase && !this.extraLifeSpawnedThisPhase) {
        this.spawnExtraLifeTreat(set);
      }
    }

    getNewestActiveObstacleSet() {
      return [...this.obstacleSets]
        .reverse()
        .find((set) => set.pieces && set.pieces.some((piece) => piece && piece.active));
    }

    triggerExtraLifeTreatSpawn() {
      if (this.phaseTransitionActive || this.gameFinished || this.extraLifeSpawnedThisPhase) {
        return;
      }

      const activeSet = this.getNewestActiveObstacleSet();
      if (activeSet) {
        this.spawnExtraLifeTreat(activeSet);
        return;
      }

      this.extraLifePendingThisPhase = true;
    }

    getTextureAspectRatio(key, fallbackRatio = 1) {
      if (!this.textures.exists(key)) {
        return fallbackRatio;
      }

      const texture = this.textures.get(key);
      const sourceImage = texture && texture.getSourceImage ? texture.getSourceImage() : null;
      if (!sourceImage || !sourceImage.width || !sourceImage.height) {
        return fallbackRatio;
      }

      return sourceImage.width / sourceImage.height;
    }

    getExtraLifeTextureKey() {
      if (this.textures.exists(EXTRA_LIFE_TEXTURE_KEY)) {
        return EXTRA_LIFE_TEXTURE_KEY;
      }

      return null;
    }

    getExtraLifeTreatSize() {
      const playerWidth = this.player ? this.player.displayWidth : Phaser.Math.Clamp(this.layout.width * 0.1, 74, 110);
      const playerHeight = this.player ? this.player.displayHeight : Math.round(playerWidth * 0.9);
      const textureKey = this.getExtraLifeTextureKey();
      const aspectRatio = this.getTextureAspectRatio(textureKey || EXTRA_LIFE_TEXTURE_KEY, EXTRA_LIFE_TEXTURE_FALLBACK_ASPECT);
      const maxWidth = Math.max(42, Math.round(playerWidth * 1.25));
      const maxHeight = Math.max(50, Math.round(playerHeight * 1.25));
      let height = maxHeight;
      let width = Math.round(height * aspectRatio);

      if (width > maxWidth) {
        width = maxWidth;
        height = Math.round(width / aspectRatio);
      }

      return {
        width,
        height
      };
    }

    getReachableTreatSpawnArea(size) {
      const playerWidth = this.player ? this.player.displayWidth : 90;
      const playerHeight = this.player ? this.player.displayHeight : 90;
      const leftPadding = Math.max(170, Math.round(playerWidth * 2.1));
      const rightPadding = Math.max(90, Math.round(size.width * 0.9));
      const topPadding = Math.max(110, Math.round(size.height * 0.7));
      const bottomPadding = Math.max(96, Math.round(playerHeight * 0.9));

      return {
        minX: Math.round(Math.max(this.player.x + leftPadding, this.layout.width * 0.48)),
        maxX: Math.round(this.layout.width - rightPadding),
        minY: Math.round(topPadding),
        maxY: Math.round(this.layout.height - this.layout.floorHeight - bottomPadding)
      };
    }

    isTreatPositionClear(x, y, width, height) {
      const horizontalPadding = Math.max(18, Math.round(width * 0.2));
      const verticalPadding = Math.max(18, Math.round(height * 0.2));
      const treatBounds = new Phaser.Geom.Rectangle(
        x - (width * 0.5) - horizontalPadding,
        y - (height * 0.5) - verticalPadding,
        width + (horizontalPadding * 2),
        height + (verticalPadding * 2)
      );
      let blocked = false;

      this.obstacles.children.each((obstacle) => {
        if (blocked || !obstacle || !obstacle.active) {
          return;
        }

        const obstacleBounds = obstacle.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(treatBounds, obstacleBounds)) {
          blocked = true;
        }
      });

      return !blocked;
    }

    spawnExtraLifeTreat(obstacleSet) {
      if (
        this.phaseTransitionActive ||
        this.gameFinished ||
        this.extraLifeSpawnedThisPhase ||
        !obstacleSet ||
        !this.getExtraLifeTextureKey()
      ) {
        return;
      }

      const activePieces = obstacleSet.pieces
        .filter((piece) => piece && piece.active);
      if (activePieces.length === 0) {
        this.extraLifePendingThisPhase = true;
        return;
      }

      const size = this.getExtraLifeTreatSize();
      const textureKey = this.getExtraLifeTextureKey();
      const spawnArea = this.getReachableTreatSpawnArea(size);
      let spawnX = null;
      let spawnY = null;

      for (let attempt = 0; attempt < 18; attempt += 1) {
        const candidateX = Phaser.Math.Between(spawnArea.minX, Math.max(spawnArea.minX, spawnArea.maxX));
        const candidateY = Phaser.Math.Between(spawnArea.minY, Math.max(spawnArea.minY, spawnArea.maxY));

        if (!this.isTreatPositionClear(candidateX, candidateY, size.width, size.height)) {
          continue;
        }

        spawnX = candidateX;
        spawnY = candidateY;
        break;
      }

      if (spawnX === null || spawnY === null) {
        const fallbackX = Phaser.Math.Clamp(
          Math.round(Math.max(this.player.x + (this.player.displayWidth * 2.2), this.layout.width * 0.62)),
          spawnArea.minX,
          Math.max(spawnArea.minX, spawnArea.maxX)
        );
        const fallbackY = Phaser.Math.Clamp(
          obstacleSet.gapCenterY,
          spawnArea.minY,
          spawnArea.maxY
        );

        if (!this.isTreatPositionClear(fallbackX, fallbackY, size.width, size.height)) {
          this.extraLifePendingThisPhase = true;
          return;
        }

        spawnX = fallbackX;
        spawnY = fallbackY;
      }

      const treat = this.extraLifeTreats.create(spawnX, spawnY, textureKey);
      const hitRadius = Math.max(12, Math.round(Math.min(size.width, size.height) * 0.3));
      const hitOffsetX = Math.round((size.width - (hitRadius * 2)) * 0.5);
      const hitOffsetY = Math.round((size.height - (hitRadius * 2)) * 0.34);

      treat.setDisplaySize(size.width, size.height);
      treat.setDepth(39);
      treat.setAngle(-18);
      treat.body.setAllowGravity(false);
      treat.body.moves = true;
      treat.body.setImmovable(true);
      treat.body.setVelocityX(-obstacleSet.speed);
      treat.body.setCircle(hitRadius, hitOffsetX, hitOffsetY);

      this.extraLifeSpawnedThisPhase = true;
      this.extraLifePendingThisPhase = false;
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
      this.powerUpsCollectedThisPhase += 1;
      this.score += 3;

      if (this.cache.audio.exists("sfx_collect")) {
        this.sound.play("sfx_collect", { volume: 0.34 });
      }

      this.cameras.main.flash(110, 255, 255, 255, false);
      this.cameras.main.shake(120, 0.0025, true);
      this.player.pulseCollect();
    }

    collectExtraLifeTreat(player, treat) {
      if (!treat.active) {
        return;
      }

      treat.destroy();
      this.lives += 1;
      this.extraLives = this.lives;
      this.playExtraLifeSound();

      this.cameras.main.flash(130, 255, 244, 200, false);
      this.cameras.main.shake(120, 0.0025, true);
      this.player.pulseCollect();
    }

    playExtraLifeSound() {
      if (this.cache.audio.exists("sfx_collect")) {
        this.sound.play("sfx_collect", { volume: 0.42, rate: 1.16 });
      }

      const audioContext = this.sound ? this.sound.context : null;
      if (!audioContext || typeof audioContext.createOscillator !== "function") {
        return;
      }

      safeResumeAudioContext(audioContext);
      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      masterGain.connect(audioContext.destination);

      const notes = [
        { frequency: 660, start: 0, duration: 0.11 },
        { frequency: 880, start: 0.11, duration: 0.11 },
        { frequency: 1175, start: 0.22, duration: 0.16 }
      ];

      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const noteStart = now + note.start;
        const noteEnd = noteStart + note.duration;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        gainNode.gain.setValueAtTime(0.0001, noteStart);
        gainNode.gain.exponentialRampToValueAtTime(0.65, noteStart + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.02);
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
      });

      this.time.delayedCall(520, () => {
        masterGain.disconnect();
      });
    }

    activateInvincibility() {
      this.clearInvincibilityState(false);
      this.isInvincible = true;
      this.player.startInvincibilityVisual();

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

      if (this.player) {
        this.player.stopInvincibilityVisual();
      }

      if (restoreVisuals) {
        return;
      }
    }

    onPlayerHit() {
      if (this.phaseTransitionActive || this.isInvincible || this.gameFinished || this.isPhaseDurationComplete()) {
        return;
      }

      this.lives -= 1;
      this.extraLives = this.lives;
      this.hud.flashDamage();

      if (this.cache.audio.exists("sfx_hit")) {
        this.sound.play("sfx_hit", { volume: 0.34 });
      }

      this.cameras.main.shake(170, 0.0045, true);

      if (this.lives <= 0) {
        this.lives = 0;
        this.extraLives = 0;
        this.finishGame(false);
        return;
      }

      this.player.setVelocityY(-Math.round(Math.max(210, this.layout.height * 0.24)));
      this.activateInvincibility();
    }

    finishGame(victory) {
      if (this.gameFinished) {
        return;
      }

      this.gameFinished = true;
      this.phaseTransitionActive = true;
      this.suspendPlayerForTransition();
      this.clearInvincibilityState();
      this.stopCurrentMusic();

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phaseRatTimers.forEach((timer) => timer.remove(false));
      this.phaseRatTimers = [];

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
      this.suspendPlayerForTransition();
      this.score += 10;

      if (this.obstacleTimer) {
        this.obstacleTimer.remove(false);
      }

      this.phasePowerUpTimers.forEach((timer) => timer.remove(false));
      this.phasePowerUpTimers = [];
      this.phaseRatTimers.forEach((timer) => timer.remove(false));
      this.phaseRatTimers = [];

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

      this.farSkyline.setTint(mixColor(this.farSkyline.grayColor, this.farSkyline.baseColor, this.worldSaturation));
      this.nearHomes.setTint(mixColor(this.nearHomes.grayColor, this.nearHomes.baseColor, this.worldSaturation));
      this.streetWalls.setTint(mixColor(this.streetWalls.grayColor, this.streetWalls.baseColor, this.worldSaturation));

      this.obstacles.children.each((obstacle) => {
        if (!obstacle.active) {
          return;
        }
        if (obstacle.usesYellowPipeArt) {
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

      const floorTop = gameSize.height - this.layout.floorHeight;
      const farLayerHeight = Math.round(gameSize.height * 0.3);
      const nearLayerHeight = Math.round(gameSize.height * 0.24);
      const wallLayerHeight = Math.max(88, Math.round(this.layout.floorHeight * 0.95));

      this.clouds.forEach((cloud, index) => {
        if (cloud.x === 0) {
          cloud.x = (gameSize.width / this.clouds.length) * index + Phaser.Math.Between(10, 90);
        }
        cloud.y = 72 + ((index % 3) * 60);
        cloud.setDisplaySize(Phaser.Math.Between(96, 150), Phaser.Math.Between(48, 74));
      });

      this.farSkyline.setPosition(0, floorTop - Math.round(this.layout.floorHeight * 0.2));
      this.farSkyline.setSize(gameSize.width, farLayerHeight);

      this.nearHomes.setPosition(0, floorTop + Math.round(this.layout.floorHeight * 0.08));
      this.nearHomes.setSize(gameSize.width, nearLayerHeight);

      this.streetWalls.setPosition(0, floorTop);
      this.streetWalls.setSize(gameSize.width, wallLayerHeight);

      const playerY = Phaser.Math.Clamp(this.player.y || this.layout.centerY, 110, gameSize.height - this.layout.floorHeight - 84);
      const targetWidth = Phaser.Math.Clamp(this.layout.width * 0.1, 74, 110);

      this.player.setDisplayWidth(targetWidth);
      this.player.setPosition(this.layout.playerStartX, playerY);

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
      this.updatePlayerVisuals(time);
      this.updateObstacles();
      this.updatePowerUps(time);
      this.updateExtraLifeTreats();
      this.updateRats();
      this.updateHud();

      if (this.player.y <= 0) {
        this.player.setPosition(this.player.x, 0);
        this.player.setVelocityY(0);
      }

      if (!this.phaseTransitionActive && !this.gameFinished && this.isPhaseDurationComplete()) {
        this.completePhase();
        return;
      }

      if (this.phaseTransitionActive || this.gameFinished) {
        return;
      }

      const floorLimit = this.layout.height - this.layout.floorHeight - 8;
      if (this.player.y >= floorLimit) {
        this.onPlayerHit();
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

      this.farSkyline.tilePositionX += this.currentPhaseConfig.parallaxFar * 0.32 * deltaSeconds;
      this.nearHomes.tilePositionX += this.currentPhaseConfig.parallaxNear * 0.48 * deltaSeconds;
      this.streetWalls.tilePositionX += this.currentPhaseConfig.parallaxNear * 0.82 * deltaSeconds;
    }

    updatePlayerVisuals(time) {
      this.player.update(this.time.now);
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

    updateExtraLifeTreats() {
      this.extraLifeTreats.children.each((treat) => {
        if (!treat.active) {
          return;
        }

        const playerRadius = Math.min(this.player.displayWidth, this.player.displayHeight) * 0.34;
        const treatRadius = Math.min(treat.displayWidth, treat.displayHeight) * 0.32;
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, treat.x, treat.y);

        if (distance <= (playerRadius + treatRadius)) {
          this.collectExtraLifeTreat(this.playerBody, treat);
          return;
        }

        if (treat.x < -80) {
          treat.destroy();
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
        extraLives: this.lives,
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

      this.heroPlayer = new window.MudaPlayer(this, {
        x: this.scale.width * 0.5,
        y: 360,
        textureKey: PLAYER_TEXTURE_KEY,
        enablePhysics: false,
        depth: 28,
        displayWidth: Phaser.Math.Clamp(this.scale.width * 0.23, 138, 220),
        trailLength: 24
      });

      this.tweens.add({
        targets: this.heroPlayer.root,
        y: this.heroPlayer.root.y + 12,
        duration: 1050,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      this.add.text(this.scale.width * 0.5, this.scale.height - 124, "Toque, clique ou pressione ESPACO para voltar ao menu.", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "18px",
        color: "#fff4ae",
        align: "center"
      }).setOrigin(0.5).setShadow(0, 2, "#0f172a", 6, true, true);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.heroPlayer) {
          this.heroPlayer.destroy();
          this.heroPlayer = null;
        }
      });

      this.input.once("pointerdown", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-UP", () => this.scene.start("MenuScene"));
    }

    update(time) {
      if (!this.heroPlayer) {
        return;
      }

      const waveVelocity = Math.sin(time * 0.0042) * 96;
      this.heroPlayer.setVelocityHint(waveVelocity);
      this.heroPlayer.update(time, waveVelocity);
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

      this.heroPlayer = new window.MudaPlayer(this, {
        x: this.scale.width * 0.5,
        y: 360,
        textureKey: PLAYER_TEXTURE_KEY,
        enablePhysics: false,
        depth: 28,
        displayWidth: Phaser.Math.Clamp(this.scale.width * 0.26, 156, 250),
        trailLength: 26
      });

      this.tweens.add({
        targets: this.heroPlayer.root,
        y: this.heroPlayer.root.y + 14,
        duration: 1020,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

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

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.heroPlayer) {
          this.heroPlayer.destroy();
          this.heroPlayer = null;
        }
      });

      this.input.once("pointerdown", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
      this.input.keyboard.once("keydown-UP", () => this.scene.start("MenuScene"));
    }

    update(time) {
      if (!this.heroPlayer) {
        return;
      }

      const waveVelocity = Math.sin(time * 0.004) * 104;
      this.heroPlayer.setVelocityHint(waveVelocity);
      this.heroPlayer.update(time, waveVelocity);
    }
  }

  const gameConfig = {
    type: window.location.protocol === "file:" ? Phaser.CANVAS : Phaser.AUTO,
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
        gravity: { y: 430 },
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, WinScene]
  };

  window.MudaGame = new Phaser.Game(gameConfig);
})();
