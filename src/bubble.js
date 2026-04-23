// Luftblase (Bubble) — Projektil, das vom Helden automatisch während des
// airBlast-Powerups abgefeuert wird. Fliegt einem Ziel entgegen und trifft bei Kontakt.

import { INK } from './render.js';

const SPEED = 520;
const MAX_LIFE = 1.6;

export class Bubble {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = MAX_LIFE;
    this.dead = false;
    this.r = 7;
    this.spinPhase = Math.random() * Math.PI * 2;
  }

  static spawnTowards(fromX, fromY, targetX, targetY) {
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * SPEED;
    const vy = (dy / len) * SPEED;
    return new Bubble(fromX, fromY, vx, vy);
  }

  get aabb() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.spinPhase += dt * 4;
    // Leichter Auftrieb — Blasen steigen minimal
    this.vy -= 60 * dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    // Blase: halbtransparent hellblau, Kontur, kleiner Glanzpunkt
    ctx.fillStyle = 'rgba(190, 230, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 120, 170, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Glanz
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    const gx = this.x + Math.cos(this.spinPhase) * 2 - 2.5;
    const gy = this.y + Math.sin(this.spinPhase) * 2 - 2.5;
    ctx.arc(gx, gy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
