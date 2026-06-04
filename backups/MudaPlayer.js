/*
  MudaPlayer

  Componente visual e fisico da gatinha Muda.
  - Agrupa sprite, outline e cauda arco-iris em um Container.
  - Pode operar com ou sem corpo fisico Arcade.
  - Mantem a hitbox centralizada apenas no corpo.
*/

(() => {
  const TRAIL_COLORS = [0xff3d54, 0xff9242, 0xffd93f, 0x61d44d, 0x2198ff, 0x8c4bff];
  const OUTLINE_OFFSETS = [
    [-4, 0], [4, 0], [0, -4], [0, 4],
    [-3, -3], [3, -3], [-3, 3], [3, 3]
  ];

  class MudaPlayer {
    constructor(scene, config) {
      this.scene = scene;
      this.textureKey = config.textureKey;
      this.enablePhysics = config.enablePhysics !== false;
      this.depth = config.depth || 30;
      this.trailLength = config.trailLength || 26;
      this.scaleFactor = 1;
      this.velocityHint = 0;
      this.damagePulseToggle = false;
      this.damagePulseEvent = null;
      this.invincibilityTween = null;
      this.trailHistory = [];

      this.root = scene.add.container(config.x, config.y).setDepth(this.depth);
      this.rainbowGraphics = scene.add.graphics().setDepth(this.depth - 1);
      this.glowSprite = scene.add.image(0, 0, this.textureKey).setTint(0xffffff).setAlpha(0.18);
      this.outlineSprites = OUTLINE_OFFSETS.map(([x, y]) => {
        const sprite = scene.add.image(x, y, this.textureKey).setTint(0x000000).setAlpha(0.98);
        return sprite;
      });
      this.baseSprite = scene.add.image(0, 0, this.textureKey);
      this.overlaySprite = scene.add.image(0, 0, this.textureKey).setAlpha(0);

      this.root.add([
        this.rainbowGraphics,
        this.glowSprite,
        ...this.outlineSprites,
        this.baseSprite,
        this.overlaySprite
      ]);

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

      this.invincibilityTween = this.scene.tweens.add({
        targets: this.root,
        alpha: 1,
        duration: 90,
        yoyo: true,
        repeat: -1
      });

      this.overlaySprite.setAlpha(0.55);
      this.overlaySprite.setTintFill(0xff4d4d);

      this.damagePulseEvent = this.scene.time.addEvent({
        delay: 95,
        loop: true,
        callback: () => {
          this.damagePulseToggle = !this.damagePulseToggle;
          this.overlaySprite.setTintFill(this.damagePulseToggle ? 0xff4d4d : 0xffffff);
          this.overlaySprite.setAlpha(this.damagePulseToggle ? 0.55 : 0.35);
        }
      });
    }

    stopInvincibilityVisual() {
      if (this.invincibilityTween) {
        this.invincibilityTween.stop();
        this.invincibilityTween = null;
      }

      if (this.damagePulseEvent) {
        this.damagePulseEvent.remove(false);
        this.damagePulseEvent = null;
      }

      this.root.setAlpha(1);
      this.rainbowGraphics.setAlpha(1);
      this.overlaySprite.setAlpha(0);
      this.overlaySprite.clearTint();
      this.damagePulseToggle = false;
    }

    update(time, velocityOverride) {
      this.syncFromBody();

      const verticalVelocity = typeof velocityOverride === "number"
        ? velocityOverride
        : (this.bodySprite ? this.bodySprite.body.velocity.y : this.velocityHint);

      this.root.angle = Phaser.Math.Clamp(verticalVelocity * 0.05, -18, 24);
      this.drawRainbowTrail(time);
    }

    drawRainbowTrail(time) {
      this.trailHistory.unshift({
        x: -(this.displayWidth * 0.34),
        y: 3
      });

      if (this.trailHistory.length > this.trailLength) {
        this.trailHistory.length = this.trailLength;
      }

      this.rainbowGraphics.clear();

      for (let stripe = 0; stripe < TRAIL_COLORS.length; stripe += 1) {
        this.rainbowGraphics.fillStyle(TRAIL_COLORS[stripe], 1);

        for (let index = 0; index < this.trailHistory.length; index += 1) {
          const point = this.trailHistory[index];
          const x = point.x - (index * 9.6);
          const wave = Math.sin((index * 0.44) + (time * 0.006)) * 4.2;
          const y = point.y + ((stripe - 2.5) * 5.4) + wave;

          this.rainbowGraphics.fillRect(x, y, 14, 6);

          if (index > 0) {
            this.rainbowGraphics.fillRect(x + 7, y, 10, 6);
          }
        }
      }
    }

    destroy() {
      this.stopInvincibilityVisual();

      if (this.bodySprite) {
        this.bodySprite.destroy();
      }

      this.root.destroy();
    }
  }

  window.MudaPlayer = MudaPlayer;
})();
