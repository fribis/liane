// Vogel: Patrouilliert horizontal, stürzt bei Annäherung auf den Spieler.

import { drawWobblyLine, wobblyPoints, fillBlob, nextSeed, INK } from '../render.js';

export class Bird {
  constructor({ patrolY, patrolMinX, patrolMaxX, lowDive = false }) {
    this.patrolY = patrolY;
    this.patrolMinX = patrolMinX;
    this.patrolMaxX = patrolMaxX;
    this.lowDive = lowDive;       // wenn true: stürzt bis fast auf Bodenhöhe → Ducken nötig
    this.x = (patrolMinX + patrolMaxX) / 2;
    this.y = patrolY;
    this.vx = 120;
    this.vy = 0;
    this.state = 'patrol';        // 'patrol' | 'swoop' | 'return'
    this.swoopT = 0;
    this.swoopStart = null;
    this.swoopTarget = null;
    this.seed = nextSeed();
    this.wingT = 0;
    this.w = 34; this.h = 18;
  }

  get aabb() {
    // Hitbox deutlich schmaler als Sprite (Flügel zählen nicht), so dass man ihm beim Ducken sauber ausweichen kann.
    return { x: this.x - 10, y: this.y - 6, w: 20, h: 12 };
  }

  update(dt, player) {
    this.wingT += dt * 14;

    if (this.state === 'patrol') {
      this.x += this.vx * dt;
      if (this.x < this.patrolMinX) { this.x = this.patrolMinX; this.vx = Math.abs(this.vx); }
      if (this.x > this.patrolMaxX) { this.x = this.patrolMaxX; this.vx = -Math.abs(this.vx); }
      // Trigger: Held horizontal in Reichweite UND unter dem Vogel
      const dx = player.cx - this.x;
      const dy = player.cy - this.y;
      if (Math.abs(dx) < 280 && dy > 40 && dy < 560) {
        this.state = 'swoop';
        this.swoopT = 0;
        this.swoopStart = { x: this.x, y: this.y };
        // LowDive-Vögel tauchen fast bis zur Bodenhöhe — man muss sich ducken.
        // Normale Vögel stürzen knapp auf Spielerhöhe.
        const targetY = this.lowDive ? 650 : player.cy + 20;
        const targetX = player.cx + Math.sign(this.vx || 1) * 140;
        this.swoopTarget = { x: targetX, y: targetY };
      }
    } else if (this.state === 'swoop') {
      this.swoopT += dt;
      const dur = 1.0;
      const t = Math.min(1, this.swoopT / dur);
      // Bézier: Kontrollpunkt ÜBER der Startposition, damit die Kurve glatt
      // zum Ziel hinabläuft OHNE darunter zu dippen. So bleibt die Ziel-Y-Linie
      // das tiefste, was die Spinne erreicht — Ducken funktioniert zuverlässig.
      const ctrlX = (this.swoopStart.x + this.swoopTarget.x) / 2;
      const ctrlY = this.swoopStart.y - 40;
      this.x = (1 - t) * (1 - t) * this.swoopStart.x + 2 * (1 - t) * t * ctrlX + t * t * this.swoopTarget.x;
      this.y = (1 - t) * (1 - t) * this.swoopStart.y + 2 * (1 - t) * t * ctrlY + t * t * this.swoopTarget.y;
      if (t >= 1) { this.state = 'return'; this.swoopT = 0; this.returnFrom = { x: this.x, y: this.y }; }
    } else if (this.state === 'return') {
      this.swoopT += dt;
      const dur = 1.2;
      const t = Math.min(1, this.swoopT / dur);
      const target = { x: Math.max(this.patrolMinX, Math.min(this.patrolMaxX, this.returnFrom.x)), y: this.patrolY };
      this.x = this.returnFrom.x + (target.x - this.returnFrom.x) * t;
      this.y = this.returnFrom.y + (target.y - this.returnFrom.y) * t;
      if (t >= 1) {
        this.state = 'patrol';
        this.vx = target.x >= this.patrolMaxX - 10 ? -Math.abs(this.vx) : Math.abs(this.vx);
        this.y = this.patrolY;
      }
    }
  }

  draw(ctx) {
    const { x, y } = this;
    const wingFlap = Math.sin(this.wingT) * 6;

    // Flügel (zwei Bögen nach oben)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.quadraticCurveTo(x - 8, y - 10 - wingFlap, x - 2, y - 2);
    ctx.moveTo(x + 14, y);
    ctx.quadraticCurveTo(x + 8, y - 10 - wingFlap, x + 2, y - 2);
    ctx.stroke();

    // Flügel-Füllung
    ctx.fillStyle = 'rgba(60, 60, 65, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.quadraticCurveTo(x - 8, y - 10 - wingFlap, x - 2, y - 2);
    ctx.lineTo(x - 2, y + 2);
    ctx.quadraticCurveTo(x - 8, y - 4 - wingFlap * 0.5, x - 14, y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 14, y);
    ctx.quadraticCurveTo(x + 8, y - 10 - wingFlap, x + 2, y - 2);
    ctx.lineTo(x + 2, y + 2);
    ctx.quadraticCurveTo(x + 8, y - 4 - wingFlap * 0.5, x + 14, y);
    ctx.fill();

    // Körper
    ctx.fillStyle = 'rgba(50, 50, 55, 0.95)';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Kopf + Schnabel
    const facing = this.state === 'swoop' ? Math.sign(this.swoopTarget.x - this.swoopStart.x) || 1 : Math.sign(this.vx) || 1;
    ctx.fillStyle = 'rgba(50, 50, 55, 0.95)';
    ctx.beginPath();
    ctx.arc(x + 6 * facing, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Schnabel
    ctx.fillStyle = 'rgba(220, 180, 60, 0.9)';
    ctx.beginPath();
    ctx.moveTo(x + 8 * facing, y - 2);
    ctx.lineTo(x + 13 * facing, y - 1);
    ctx.lineTo(x + 8 * facing, y);
    ctx.closePath();
    ctx.fill();
    // Auge
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 6 * facing, y - 3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + 6.5 * facing, y - 3, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
