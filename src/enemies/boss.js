// Endgegner: Feuerkröte vor der Zielfahne.
//
// Ablauf (state):
//   sleep      → wartet, bis der Held die Arena betritt
//   shoot      → spuckt Feuerbälle, die am Boden auf den Held zurollen (drüberspringen!)
//   dazed      → nach einer Salve 3 s benommen: drei kreisende Ellipsen über dem Kopf.
//                Nur jetzt kann man ihn durch Draufspringen treffen.
//   hurt       → kurz unverwundbar + blinkend, dann wieder shoot (oder windup)
//   windup     → nach dem 3. Treffer: holt Luft für den letzten Sprung ("!")
//   leap       → springt im Bogen auf die Position des Helden (ausweichen!)
//   collapse   → landet, kippt um
//   defeated   → weg, Fahne frei
//
// Kollisionen mit dem Helden und den Feuerbällen wertet main.js über
// `playerContact()` / `fireballHits()` aus.

import { INK } from '../render.js';

const GRAVITY = 1800;
const LIVES = 3;
const DAZE_TIME = 3;
// Pro Phase (= verlorene Leben): Schüsse bis zur Benommenheit, Abstand, Tempo
const PHASES = [
  { shots: 5, interval: 1.3, speed: 300 },
  { shots: 6, interval: 1.1, speed: 340 },
  { shots: 7, interval: 0.9, speed: 380 },
];

export class Boss {
  constructor({ x, groundY = 680, arenaStartX, minX, maxX }) {
    this.homeX = x;
    this.x = x;                 // Mitte
    this.groundY = groundY;     // Füße
    this.y = groundY;
    this.arenaStartX = arenaStartX ?? x - 500;
    this.minX = minX ?? x - 700;
    this.maxX = maxX ?? x + 200;
    this.w = 96;
    this.h = 86;
    this.isBoss = true;

    this.lives = LIVES;
    this.state = 'sleep';
    this.timer = 0;
    this.shotsFired = 0;
    this.shootCooldown = 1.0;
    this.mouthOpen = 0;         // 0..1 für die Spuck-Animation
    this.vx = 0;
    this.vy = 0;
    this.rot = 0;
    this.alpha = 1;
    this.t = 0;
    this.fireballs = [];
  }

  get awake() { return this.state !== 'sleep'; }
  get defeated() { return this.state === 'defeated'; }
  // Noch nicht besiegt (Herzen anzeigen, Fahne gesperrt).
  get blocksPath() { return this.state !== 'collapse' && this.state !== 'defeated'; }
  // Unsichtbare Wand: man kommt nicht an ihm vorbei — außer beim letzten Sprung,
  // da muss man ausweichen können (auch unter ihm durch).
  get walls() { return this.blocksPath && this.state !== 'leap'; }

  get aabb() {
    return { x: this.x - this.w / 2 + 8, y: this.y - this.h + 10, w: this.w - 16, h: this.h - 10 };
  }

  update(dt, player) {
    this.t += dt;
    this.mouthOpen = Math.max(0, this.mouthOpen - dt * 3);
    const phase = PHASES[Math.min(LIVES - this.lives, PHASES.length - 1)];

    switch (this.state) {
      case 'sleep':
        if (player.cx > this.arenaStartX) {
          this.state = 'shoot';
          this.shootCooldown = 1.0;   // kurze Schonfrist nach dem Aufwachen
        }
        break;

      case 'shoot':
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0) {
          this.spit(phase.speed);
          this.shotsFired++;
          this.shootCooldown = phase.interval;
          if (this.shotsFired >= phase.shots) {
            this.state = 'dazed';
            this.timer = DAZE_TIME;
            // Ausgepowert: alle Feuerbälle verpuffen, das 3-s-Fenster gehört dem Spieler.
            for (const f of this.fireballs) f.fizzle = 0.35;
          }
        }
        break;

      case 'dazed':
        this.timer -= dt;
        if (this.timer <= 0) this.toShoot();
        break;

      case 'hurt':
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.lives > 0) this.toShoot();
          else { this.state = 'windup'; this.timer = 0.8; }
        }
        break;

      case 'windup':
        this.timer -= dt;
        if (this.timer <= 0) this.leapAt(player.cx);
        break;

      case 'leap':
        this.vy += GRAVITY * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        if (this.y >= this.groundY && this.vy > 0) {
          this.y = this.groundY;
          this.state = 'collapse';
          this.timer = 1.4;
        }
        break;

      case 'collapse':
        this.timer -= dt;
        this.rot = Math.min(Math.PI / 2, this.rot + dt * 3);
        if (this.timer < 0.6) this.alpha = Math.max(0, this.timer / 0.6);
        if (this.timer <= 0) this.state = 'defeated';
        break;
    }

    // Feuerbälle
    for (const f of this.fireballs) {
      f.x += f.vx * dt;
      f.life -= dt;
      f.spin += dt * 10;
      if (f.fizzle !== undefined) {
        f.fizzle -= dt;
        f.vx *= 0.9;
        if (f.fizzle <= 0) f.life = 0;
      }
    }
    this.fireballs = this.fireballs.filter(f => f.life > 0 && f.x > this.minX - 400);
  }

  toShoot() {
    this.state = 'shoot';
    this.shotsFired = 0;
    this.shootCooldown = 0.8;
  }

  spit(speed) {
    this.mouthOpen = 1;
    this.fireballs.push({
      x: this.x - this.w / 2 - 6,
      y: this.groundY - 16,     // Bodenhöhe: Ducken hilft nicht, man muss springen
      r: 12,
      vx: -speed,
      life: 4,
      spin: Math.random() * 6,
    });
  }

  // Letzter Sprung: Bogen, der ~1 s später an der aktuellen Position des Helden landet.
  leapAt(targetX) {
    const T = 1.0;
    const tx = Math.max(this.minX, Math.min(this.maxX, targetX));
    this.vx = (tx - this.x) / T;
    this.vy = -GRAVITY * T / 2;
    this.y = this.groundY - 1;
    this.state = 'leap';
    this.fireballs = [];
  }

  // Ergebnis einer Berührung mit dem Helden: 'none' | 'stomp' | 'kill'
  playerContact(player) {
    if (this.state === 'sleep' || this.state === 'collapse' || this.state === 'defeated') return 'none';
    const p = player.hitbox;
    const b = this.aabb;
    const overlap = p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y;
    if (!overlap) return 'none';
    if (this.state === 'hurt') return 'none';      // kurz nach einem Treffer harmlos
    if (this.state === 'dazed') {
      const fromAbove = player.vy > 0 && (player.y + player.h) - b.y < 26;
      if (fromAbove) {
        this.lives--;
        this.state = 'hurt';
        this.timer = 0.9;
        this.fireballs = [];
        return 'stomp';
      }
    }
    return 'kill';
  }

  fireballHits(player) {
    const p = player.hitbox;
    return this.fireballs.some(f => f.fizzle === undefined &&
      f.x + f.r > p.x && f.x - f.r < p.x + p.w && f.y + f.r > p.y && f.y - f.r < p.y + p.h);
  }

  // === Zeichnen ===========================================================

  draw(ctx) {
    for (const f of this.fireballs) this.drawFireball(ctx, f);
    if (this.state === 'defeated') return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    // Beim Treffer blinken
    if (this.state === 'hurt' && Math.floor(this.t * 14) % 2 === 0) ctx.globalAlpha *= 0.35;

    // Atmen / Squash beim Ausholen
    let sx = 1, sy = 1;
    if (this.state === 'sleep') sy = 1 + Math.sin(this.t * 2) * 0.03;
    if (this.state === 'windup') { sx = 1.12; sy = 0.86; }
    if (this.state === 'leap') { sx = 0.92; sy = 1.1; }

    ctx.translate(this.x, this.y);
    ctx.rotate(-this.rot);
    ctx.scale(sx, sy);
    this.drawBody(ctx);
    ctx.restore();

    if (this.state === 'sleep') this.drawZzz(ctx);
    if (this.state === 'dazed') this.drawDazeEllipses(ctx);
    if (this.state === 'windup') this.drawExclaim(ctx);
    if (this.awake && this.blocksPath) this.drawHearts(ctx);
  }

  // Körper im lokalen Koordinatensystem (0,0) = Mitte der Füße; schaut nach links.
  drawBody(ctx) {
    const w = this.w, h = this.h;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Beine
    ctx.fillStyle = '#a8371f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (const lx of [-28, 22]) {
      ctx.beginPath();
      ctx.ellipse(lx, -8, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // Rumpf: breiter Tropfen
    ctx.fillStyle = '#c94a2a';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -12);
    ctx.bezierCurveTo(-w / 2 - 4, -h * 0.75, -w * 0.2, -h - 6, w * 0.12, -h + 2);
    ctx.bezierCurveTo(w * 0.45, -h + 6, w / 2 + 4, -h * 0.5, w / 2, -14);
    ctx.quadraticCurveTo(0, -2, -w / 2, -12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Heller Bauch
    ctx.fillStyle = '#f2b86a';
    ctx.beginPath();
    ctx.ellipse(-6, -24, w * 0.3, h * 0.2, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Rücken-Zacken
    ctx.fillStyle = '#7d2414';
    for (let i = 0; i < 4; i++) {
      const bx = -4 + i * 12, by = -h + 4 + i * 6;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by + 4);
      ctx.lineTo(bx, by - 10);
      ctx.lineTo(bx + 6, by + 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Hörner
    ctx.fillStyle = '#f4e3c0';
    for (const hx of [-30, -8]) {
      ctx.beginPath();
      ctx.moveTo(hx - 6, -h + 14);
      ctx.quadraticCurveTo(hx - 14, -h - 8, hx - 2, -h - 14);
      ctx.quadraticCurveTo(hx - 4, -h + 2, hx + 5, -h + 12);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Augen
    const eyeY = -h * 0.62;
    for (const ex of [-32, -12]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      if (this.state === 'sleep') {
        // geschlossene Augen
        ctx.fillStyle = '#c94a2a';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, 8.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex - 7, eyeY + 1); ctx.quadraticCurveTo(ex, eyeY + 5, ex + 7, eyeY + 1); ctx.stroke();
      } else if (this.state === 'dazed' || this.state === 'collapse') {
        // Spiralaugen
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) {
          const r = 0.9 * a;
          const px = ex + Math.cos(a + this.t * 6) * r;
          const py = eyeY + Math.sin(a + this.t * 6) * r;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.lineWidth = 2.5;
      } else {
        ctx.beginPath(); ctx.arc(ex - 2, eyeY + 1, 3.5, 0, Math.PI * 2); ctx.fill();
        // böse Augenbrauen
        ctx.beginPath(); ctx.moveTo(ex - 10, eyeY - 12); ctx.lineTo(ex + 7, eyeY - 7); ctx.stroke();
      }
    }

    // Maul (vorne links), öffnet sich beim Spucken
    const mo = Math.max(this.mouthOpen, this.state === 'windup' ? 0.6 : 0);
    ctx.fillStyle = mo > 0.05 ? '#3a0d06' : '#c94a2a';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h * 0.36);
    ctx.quadraticCurveTo(-w * 0.25, -h * 0.36 + 4 + mo * 16, -4, -h * 0.34);
    ctx.quadraticCurveTo(-w * 0.25, -h * 0.36 - 2, -w / 2 + 2, -h * 0.36);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (mo > 0.3) {
      // Glut im Maul
      ctx.fillStyle = `rgba(255, 170, 40, ${mo})`;
      ctx.beginPath(); ctx.ellipse(-w * 0.3, -h * 0.34 + 4, 8, 4 * mo, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawFireball(ctx, f) {
    if (f.fizzle !== undefined) {
      // Verpuffen: kleiner werdendes graues Rauchwölkchen
      const k = Math.max(0, f.fizzle / 0.35);
      ctx.fillStyle = `rgba(120, 120, 120, ${0.6 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y - (1 - k) * 18, f.r * (0.6 + (1 - k)), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const flick = Math.sin(f.spin * 1.7) * 2;
    // Flammenschweif (hinter dem Ball, also rechts — der Ball rollt nach links)
    ctx.fillStyle = 'rgba(255, 140, 30, 0.55)';
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - f.r);
    ctx.quadraticCurveTo(f.x + f.r * 2.6, f.y - f.r * 0.6 + flick, f.x + f.r * 3.2, f.y + flick);
    ctx.quadraticCurveTo(f.x + f.r * 2.4, f.y + f.r * 0.6, f.x, f.y + f.r);
    ctx.closePath();
    ctx.fill();
    // Kern
    const g = ctx.createRadialGradient(f.x - 3, f.y - 3, 1, f.x, f.y, f.r);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffb030');
    g.addColorStop(1, '#e0441c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Drei kreisende Ellipsen über dem Kopf = "jetzt verwundbar"
  drawDazeEllipses(ctx) {
    const cx = this.x - 10, cy = this.y - this.h - 34;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = this.t * 4 + i * (Math.PI * 2 / 3);
      const ex = cx + Math.cos(a) * 34;
      const ey = cy + Math.sin(a) * 10;
      ctx.fillStyle = '#ffe26a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 11, 6, a * 0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawZzz(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 26, 46, 0.75)';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const k = (this.t * 0.6 + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.font = `bold ${16 + i * 5}px 'Comic Sans MS', 'Marker Felt', sans-serif`;
      ctx.fillText('z', this.x - 30 - k * 30, this.y - this.h - 10 - k * 50);
    }
    ctx.restore();
  }

  drawExclaim(ctx) {
    ctx.save();
    ctx.fillStyle = '#ff5030';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.font = "bold 44px 'Comic Sans MS', 'Marker Felt', sans-serif";
    const y = this.y - this.h - 20 + Math.sin(this.t * 30) * 2;
    ctx.strokeText('!', this.x - 10, y);
    ctx.fillText('!', this.x - 10, y);
    ctx.restore();
  }

  drawHearts(ctx) {
    const top = this.y - this.h - (this.state === 'dazed' ? 70 : 34);
    for (let i = 0; i < LIVES; i++) {
      const hx = this.x - 32 + i * 26;
      const full = i < this.lives;
      ctx.save();
      ctx.translate(hx, top);
      ctx.fillStyle = full ? '#e8384f' : 'rgba(255,255,255,0.25)';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-12, -2, -6, -12, 0, -5);
      ctx.bezierCurveTo(6, -12, 12, -2, 0, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}
