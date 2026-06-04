/*
  MudaPlayer v2

  Componente visual e fisico da gatinha Muda.
  - Agrupa sprite, outline e cauda arco-iris em um Container.
  - Pode operar com ou sem corpo fisico Arcade.
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
      this.damagePulseToggle = false;
      this.damagePulseEvent = null;
      this.invincibilityTween = null;
      this.trailHistory = [];

      this.root = scene.add.container(config.x, config.y).setDepth(this.depth);
      this.rainbowGraphics = scene.add.graphics().setDepth(this.depth - 1);
      this.baseSprite = scene.add.image(0, 0, this.textureKey);

      this.root.add([
        this.rainbowGraphics,
        this.baseSprite
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
      this.damagePulseToggle = false;
    }

    update(time, velocityOverride) {
      this.syncFromBody();

      const verticalVelocity = typeof velocityOverride === "number"
        ? velocityOverride
        : (this.bodySprite ? this.bodySprite.body.velocity.y : this.velocityHint);

      this.root.angle = Phaser.Math.Clamp(verticalVelocity * 0.043, -15, 22);
      this.drawRainbowTrail(time);
    }

    drawRainbowTrail(time) {
      this.trailHistory.unshift({
        x: -(this.displayWidth * 0.53),
        y: 1
      });

      if (this.trailHistory.length > this.trailLength) {
        this.trailHistory.length = this.trailLength;
      }

      this.rainbowGraphics.clear();

      for (let stripe = 0; stripe < TRAIL_COLORS.length; stripe += 1) {
        this.rainbowGraphics.fillStyle(TRAIL_COLORS[stripe], 1);

        for (let index = 0; index < this.trailHistory.length; index += 1) {
          const point = this.trailHistory[index];
          const x = point.x - (index * 10.2);
          const wave = Math.sin((index * 0.44) + (time * 0.0064)) * 3.5;
          const y = point.y + ((stripe - 2.5) * 4.8) + wave;

          this.rainbowGraphics.fillRect(x, y, 18, 7);

          if (index > 0) {
            this.rainbowGraphics.fillRect(x + 10, y, 11, 7);
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
