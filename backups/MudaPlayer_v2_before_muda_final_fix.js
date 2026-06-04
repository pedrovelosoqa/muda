/*
  MudaPlayer v2

  Componente visual e fisico da gatinha Muda.
  - Exibe a gatinha com as cores originais do PNG, sem tinturas extras.
  - Desenha o arco-iris exclusivamente com Graphics e retangulos coloridos.
  - Mantem a hitbox centralizada apenas no corpo.
*/

(() => {
  const TRAIL_COLORS = [0xff4257, 0xff9940, 0xffdb42, 0x67d54a, 0x1a98ff, 0x8550ff];

  class MudaPlayer {
    constructor(scene, config) {
      this.scene = scene;
      this.textureKey = config.textureKey;
      this.enablePhysics = config.enablePhysics !== false;
      this.depth = config.depth || 30;
      this.trailLength = config.trailLength || 26;
      this.scaleFactor = 1;
      this.velocityHint = 0;
      this.invincibilityTween = null;
      this.trailHistory = [];

      this.rainbowGraphics = scene.add.graphics().setDepth(this.depth - 2);
      this.root = scene.add.container(config.x, config.y).setDepth(this.depth);
      this.baseSprite = scene.add.image(0, 0, this.textureKey);

      this.root.add([this.baseSprite]);

      if (this.enablePhysics) {
        this.bodySprite = scene.physics.add.sprite(config.x, config.y, this.textureKey);
        this.bodySprite.setVisible(false);
        this.bodySprite.setAlpha(0);
        this.bodySprite.setCollideWorldBounds(false);
        this.bodySprite.body.setAllowGravity(true);
      } else {
        this.bodySprite = null;
      }

      if (config.displayWidth) {
        this.setDisplayWidth(config.displayWidth);
      }
    }

    get x() {
      return this.enablePhysics ? this.bodySprite.x : this.root.x;
    }

    get y() {
      return this.enablePhysics ? this.bodySprite.y : this.root.y;
    }

    get body() {
      return this.enablePhysics ? this.bodySprite.body : null;
    }

    get displayWidth() {
      return this.baseSprite.width * this.scaleFactor;
    }

    get displayHeight() {
      return this.baseSprite.height * this.scaleFactor;
    }

    setDisplayWidth(width) {
      this.scaleFactor = width / this.baseSprite.width;
      this.root.setScale(this.scaleFactor);

      if (this.bodySprite) {
        this.bodySprite.setScale(this.scaleFactor);
        this.refreshHitbox();
      }
    }

    refreshHitbox() {
      if (!this.bodySprite) {
        return;
      }

      this.bodySprite.body.setSize(this.displayWidth * 0.5, this.displayHeight * 0.5, true);
      this.bodySprite.body.setOffset(this.displayWidth * 0.25, this.displayHeight * 0.29);
    }

    setPosition(x, y) {
      if (this.bodySprite) {
        this.bodySprite.setPosition(x, y);
      }

      this.root.setPosition(x, y);
    }

    setVelocityY(value) {
      if (this.bodySprite) {
        this.bodySprite.setVelocityY(value);
      } else {
        this.velocityHint = value;
      }
    }

    syncFromBody() {
      if (this.bodySprite) {
        this.root.setPosition(this.bodySprite.x, this.bodySprite.y);
      }
    }

    setVelocityHint(value) {
      this.velocityHint = value;
    }

    pulseCollect() {
      this.scene.tweens.add({
        targets: this.root,
        scaleX: this.scaleFactor * 1.06,
        scaleY: this.scaleFactor * 1.06,
        duration: 120,
        yoyo: true
      });
    }

    startInvincibilityVisual() {
      this.stopInvincibilityVisual();

      this.root.setAlpha(0.5);
      this.rainbowGraphics.setAlpha(0.5);

      this.invincibilityTween = this.scene.tweens.add({
        targets: [this.root, this.rainbowGraphics],
        alpha: 1,
        duration: 90,
        yoyo: true,
        repeat: -1
      });
    }

    stopInvincibilityVisual() {
      if (this.invincibilityTween) {
        this.invincibilityTween.stop();
        this.invincibilityTween = null;
      }

      this.root.setAlpha(1);
      this.rainbowGraphics.setAlpha(1);
    }

    update(time, velocityOverride) {
      this.syncFromBody();

      const verticalVelocity = typeof velocityOverride === "number"
        ? velocityOverride
        : (this.bodySprite ? this.bodySprite.body.velocity.y : this.velocityHint);

      this.root.angle = Phaser.Math.Clamp(verticalVelocity * 0.043, -15, 22);
      this.drawRainbowTrail(time);
    }

    getTailAnchor() {
      const angleRad = Phaser.Math.DegToRad(this.root.angle);
      const localX = -(this.displayWidth * 0.42);
      const localY = this.displayHeight * 0.03;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      return {
        x: this.root.x + (localX * cos) - (localY * sin),
        y: this.root.y + (localX * sin) + (localY * cos)
      };
    }

    drawRainbowTrail(time) {
      const anchor = this.getTailAnchor();
      this.trailHistory.unshift(anchor);

      if (this.trailHistory.length > this.trailLength) {
        this.trailHistory.length = this.trailLength;
      }

      this.rainbowGraphics.clear();

      for (let stripe = 0; stripe < TRAIL_COLORS.length; stripe += 1) {
        this.rainbowGraphics.fillStyle(TRAIL_COLORS[stripe], 1);

        for (let index = 0; index < this.trailHistory.length; index += 1) {
          const point = this.trailHistory[index];
          const wave = Math.sin((index * 0.42) + (time * 0.0062)) * 2.8;
          const y = point.y + ((stripe - 2.5) * 4.6) + wave;
          const width = Math.max(10, 18 - Math.floor(index * 0.22));
          const height = 6;
          const x = point.x - width + 2;

          this.rainbowGraphics.fillRect(x, y, width, height);
        }
      }
    }

    destroy() {
      this.stopInvincibilityVisual();

      if (this.bodySprite) {
        this.bodySprite.destroy();
      }

      this.rainbowGraphics.destroy();
      this.root.destroy();
    }
  }

  window.MudaPlayer = MudaPlayer;
})();
