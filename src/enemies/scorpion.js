// Skorpion: Boden-Patrouille → klettert Baum hoch → lauert → klettert runter.

import { drawWobblyLine, wobblyPoints, fillBlob, nextSeed, INK } from '../render.js';

export class Scorpion {
  constructor({ patrolMinX, patrolMaxX, climbTreeIndex }, level) {
    this.patrolMinX = patrolMinX;
    this.patrolMaxX = patrolMaxX;
    this.climbTreeIndex = climbTreeIndex;
    this.level = level;
    this.x = (patrolMinX + patrolMaxX) / 2;
    this.groundY = 680;               // wird im update aus Plattformen korrigiert
    this.y = this.groundY;
    this.state = 'ground';            // ground | approach | climbing | onBranch | descending
    this.dir = 1;                     // Laufrichtung
    this.rotation = 0;                // 0 = horizontal, -Math.PI/2 = am Stamm nach oben
    this.timer = 0;
    this.speed = 80;
    this.climbSpeed = 120;
    this.seed = nextSeed();
    this.legPhase = 0;
    this.w = 36; this.h = 18;
  }

  // Hitbox passt ungefähr (leicht kleiner als visuell)
  get aabb() {
    if (this.state === 'climbing' || this.state === 'descending' || this.state === 'onBranch') {
      // vertikal orientiert
      return { x: this.x - 9, y: this.y - 18, w: 18, h: 36 };
    }
    return { x: this.x - 18, y: this.y - 10, w: 36, h: 18 };
  }

  targetTree() { return this.level.trees[this.climbTreeIndex]; }

  update(dt, player) {
    this.legPhase += dt * 8;
    const tree = this.targetTree();

    if (this.state === 'ground') {
      this.x += this.dir * this.speed * dt;
      if (this.x < this.patrolMinX) { this.x = this.patrolMinX; this.dir = 1; }
      if (this.x > this.patrolMaxX) { this.x = this.patrolMaxX; this.dir = -1; }
      // Trigger zum Klettern: Held oben und in Reichweite des Baums
      if (tree && player.cy < tree.topY + 60 && Math.abs(player.cx - tree.stumpX) < 250) {
        this.state = 'approach';
      }
    } else if (this.state === 'approach') {
      const targetX = tree.stumpX - tree.stumpW / 2 - 4;
      const dx = targetX - this.x;
      this.dir = Math.sign(dx) || 1;
      this.x += this.dir * this.speed * 1.3 * dt;
      if (Math.abs(dx) < 6) {
        this.x = targetX;
        this.state = 'climbing';
        this.rotation = -Math.PI / 2;   // dreht sich zum Stamm
        this.timer = 0;
      }
    } else if (this.state === 'climbing') {
      this.y -= this.climbSpeed * dt;
      if (this.y <= tree.topY + 20) {
        this.y = tree.topY + 20;
        this.state = 'onBranch';
        this.timer = 0;
      }
    } else if (this.state === 'onBranch') {
      this.timer += dt;
      if (this.timer > 2.5) {
        this.state = 'descending';
      }
    } else if (this.state === 'descending') {
      this.y += this.climbSpeed * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.rotation = 0;
        this.state = 'ground';
      }
    }

    // Ground-Y aus nächster Plattform ermitteln (einmalig reicht nicht, aber für Patrouille ok)
    for (const p of this.level.platforms) {
      if (this.x >= p.x && this.x <= p.x + p.w) {
        this.groundY = p.y - 10;
      }
    }
    if (this.state === 'ground') this.y = this.groundY;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const legSwing = Math.sin(this.legPhase) * 2;

    // Körper (ovales Segment)
    ctx.fillStyle = 'rgba(170, 130, 70, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hinterleib-Segmente
    ctx.fillStyle = 'rgba(150, 110, 60, 0.8)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(-8 - i * 4, 0 + Math.sin(this.legPhase + i) * 0.5, 4 - i * 0.4, 4 - i * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Stachel-Schwanz (aufgerollt über dem Rücken)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-24, -12, -14, -14);
    ctx.quadraticCurveTo(-4, -16, 2, -10);
    ctx.stroke();
    // Stachel-Spitze
    ctx.fillStyle = 'rgba(100, 70, 40, 0.95)';
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(8, -6);
    ctx.lineTo(2, -4);
    ctx.closePath();
    ctx.fill();

    // Scheren/Klauen vorn
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, -3); ctx.lineTo(18, -8); ctx.lineTo(22, -4);
    ctx.moveTo(18, -8); ctx.lineTo(20, -10);
    ctx.moveTo(10, 3); ctx.lineTo(18, 8); ctx.lineTo(22, 4);
    ctx.moveTo(18, 8); ctx.lineTo(20, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(140, 100, 60, 0.8)';
    ctx.beginPath();
    ctx.moveTo(14, -3); ctx.lineTo(19, -7); ctx.lineTo(21, -4); ctx.lineTo(15, 0); ctx.closePath();
    ctx.moveTo(14, 3); ctx.lineTo(19, 7); ctx.lineTo(21, 4); ctx.lineTo(15, 0); ctx.closePath();
    ctx.fill();

    // Beine (4 Paar)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const bx = -6 + i * 4;
      const flip = i % 2 === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 2, 7 + legSwing * flip);
      ctx.lineTo(bx + 5, 9 + legSwing * flip);
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 2, -7 - legSwing * flip);
      ctx.lineTo(bx + 5, -9 - legSwing * flip);
      ctx.stroke();
    }

    ctx.restore();
  }
}
