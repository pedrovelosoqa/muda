(() => {
  const TRAIL_COLORS = [0xff4257, 0xff9940, 0xffdb42, 0x67d54a, 0x1a98ff, 0x8550ff];
  const FILL_PATCH_COLOR = 0xf5ebd5;

  class MudaPlayer {
    constructor(scene, config) {
      this.scene = scene;
      this.textureKey = config.textureKey || "muda_final";
      this.enablePhysics = config.enablePhysics !== false;
      this.depth = config.depth || 30;
      this.trailLength = config.trailLength || 26;
      this.scaleFactor = 1;
      this.velocityHint = 0;
      this.invincibilityTween = null;
      this.trailHistory = [];

      this.rainbowGraphics = scene.add.graphics().setDepth(20);
      this.rainbowGraphics.x = 0;
      this.rainbowGraphics.y = 0;

      this.root = scene.add.container(config.x, config.y).setDepth(this.depth);
      this.fillPatch = scene.add.graphics().setAlpha(0.96);
      this.baseSprite = scene.add.image(0, 0, this.textureKey);
      this.root.add(this.fillPatch);
      this.root.add(this.baseSprite);
      this.redrawFillPatch();

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

    redrawFillPatch() {
      const width = this.baseSprite.width;
      const height = this.baseSprite.height;

      this.fillPatch.clear();
      this.fillPatch.fillStyle(FILL_PATCH_COLOR, 1);

      // Base cream silhouette to cover transparent pinholes inside the cat art.
      this.fillPatch.fillEllipse(-(width * 0.08), height * 0.12, width * 0.54, height * 0.52);
      this.fillPatch.fillEllipse(width * 0.06, -(height * 0.12), width * 0.42, height * 0.36);
      this.fillPatch.fillEllipse(width * 0.12, height * 0.06, width * 0.24, height * 0.34);
      this.fillPatch.fillTriangle(
        -(width * 0.02), -(height * 0.22),
        width * 0.05, -(height * 0.43),
        width * 0.12, -(height * 0.2)
      );
      this.fillPatch.fillTriangle(
        width * 0.12, -(height * 0.2),
        width * 0.2, -(height * 0.42),
        width * 0.28, -(height * 0.16)
      );
    }

    syncFillPatch() {
      this.fillPatch.setPosition(0, 0);
      this.fillPatch.setAlpha(Math.max(0.88, this.baseSprite.alpha));
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
      this.syncFillPatch();

      if (this.bodySprite) {
        this.bodySprite.setScale(this.scaleFactor);
        this.refreshHitbox();
      }
    }

    refreshHitbox() {
      if (!this.bodySprite) {
        return;
      }

      const radius = Math.round(Math.min(this.displayWidth, this.displayHeight) * 0.5);
      const offsetX = Math.round((this.displayWidth - (radius * 2)) * 0.5);
      const offsetY = Math.round((this.displayHeight - (radius * 2)) * 0.5);

      this.bodySprite.body.setCircle(radius, offsetX, offsetY);
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

    setVelocityHint(value) {
      this.velocityHint = value;
    }

    syncFromBody() {
      if (this.bodySprite) {
        this.root.setPosition(this.bodySprite.x, this.bodySprite.y);
      }
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
      this.baseSprite.setAlpha(0.5);

      this.invincibilityTween = this.scene.tweens.add({
        targets: this.baseSprite,
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

      this.baseSprite.setAlpha(1);
    }

    update(time, velocityOverride) {
      this.syncFromBody();
      this.syncFillPatch();

      const verticalVelocity = typeof velocityOverride === "number"
        ? velocityOverride
        : (this.bodySprite ? this.bodySprite.body.velocity.y : this.velocityHint);

      this.root.angle = Phaser.Math.Clamp(verticalVelocity * 0.043, -15, 22);
      this.drawRainbowTrail(time);
    }

    getTailAnchor() {
      const angleRad = Phaser.Math.DegToRad(this.root.angle);
      const localX = -(this.displayWidth * 0.42);
      const localY = this.displayHeight * 0.04;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      return {
        x: this.root.x + (localX * cos) - (localY * sin),
        y: this.root.y + (localX * sin) + (localY * cos)
      };
    }

    drawRainbowTrail(time) {
      this.rainbowGraphics.clear();

      const anchor = this.getTailAnchor();
      this.trailHistory.unshift(anchor);

      if (this.trailHistory.length > this.trailLength) {
        this.trailHistory.length = this.trailLength;
      }

      for (let stripe = 0; stripe < TRAIL_COLORS.length; stripe += 1) {
        this.rainbowGraphics.fillStyle(TRAIL_COLORS[stripe], 1);

        for (let index = 0; index < this.trailHistory.length; index += 1) {
          const point = this.trailHistory[index];
          const wave = Math.sin((index * 0.42) + (time * 0.006)) * 2.2;
          const width = Math.max(10, 18 - Math.floor(index * 0.22));
          const height = 6;
          const x = point.x - width + 2;
          const y = point.y + ((stripe - 2.5) * 4.5) + wave;

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
