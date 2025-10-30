import { Engine, World, Bodies, Body, Constraint, Composite } from 'matter-js';

export class PhysicsSystem {
  public engine!: Engine;
  private playerBody: Body | null = null;
  private platformBodies: Body[] = [];
  private accumulatorMs: number = 0;
  private ropeConstraint: Constraint | null = null;
  private ropeAnchor: { x: number; y: number } | null = null;
  private pullRatePerSec: number = 0; // px/s, 0이면 끔

  init(gravityY: number = 1): void {
    this.engine = Engine.create();
    this.engine.gravity.y = gravityY; // 기본 1.0 권장
    this.accumulatorMs = 0;
  }

  reset(): void {
    if (!this.engine) return;
    World.clear(this.engine.world, false);
    (this.engine as any).pairs?.list?.splice?.(0);
    this.playerBody = null;
    this.platformBodies = [];
    this.accumulatorMs = 0;
    this.ropeConstraint = null;
    this.ropeAnchor = null;
    this.pullRatePerSec = 0;
  }

  createPlayerBody(x: number, y: number, radius: number = 15): void {
    this.playerBody = Bodies.circle(x, y, radius, {
      restitution: 0,
      friction: 0.01,
      frictionStatic: 0,
      frictionAir: 0.02,
      inertia: Infinity // 회전 억제
    });
    World.add(this.engine.world, this.playerBody);
  }

  setPlayerStatic(isStatic: boolean): void {
    if (!this.playerBody) return;
    Body.setStatic(this.playerBody, isStatic);
  }

  setPlayerVelocity(vx: number, vy: number): void {
    if (!this.playerBody) return;
    Body.setVelocity(this.playerBody, { x: vx, y: vy });
  }

  setPlayerPosition(x: number, y: number): void {
    if (!this.playerBody) return;
    Body.setPosition(this.playerBody, { x, y });
  }

  getPlayerPosition(): { x: number; y: number; vx: number; vy: number } | null {
    if (!this.playerBody) return null;
    return {
      x: this.playerBody.position.x,
      y: this.playerBody.position.y,
      vx: this.playerBody.velocity.x,
      vy: this.playerBody.velocity.y
    };
  }

  addPlatformBody(x: number, y: number, width: number, height: number): void {
    // Matter는 중심/폭 기준, 픽시는 좌상단 기준 → 보정
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rect = Bodies.rectangle(cx, cy, width, height, {
      isStatic: true,
      friction: 0.3,
      frictionStatic: 0.5,
      restitution: 0
    });
    this.platformBodies.push(rect);
    World.add(this.engine.world, rect);
  }

  attachRope(anchorX: number, anchorY: number): void {
    if (!this.playerBody) return;
    // 기존 제약 제거
    if (this.ropeConstraint) {
      Composite.remove(this.engine.world, this.ropeConstraint);
      this.ropeConstraint = null;
    }
    const dx = this.playerBody.position.x - anchorX;
    const dy = this.playerBody.position.y - anchorY;
    const length = Math.max(10, Math.hypot(dx, dy));
    this.ropeAnchor = { x: anchorX, y: anchorY };
    this.ropeConstraint = Constraint.create({
      bodyA: this.playerBody,
      pointB: { x: anchorX, y: anchorY },
      length,
      stiffness: 0.002, // 낮은 강성으로 펜듈럼 느낌
      damping: 0.02
    });
    Composite.add(this.engine.world, this.ropeConstraint);
  }

  detachRope(): void {
    if (this.ropeConstraint) {
      Composite.remove(this.engine.world, this.ropeConstraint);
      this.ropeConstraint = null;
    }
    this.ropeAnchor = null;
    this.pullRatePerSec = 0;
  }

  startPull(ratePerSec: number): void {
    this.pullRatePerSec = Math.max(0, ratePerSec);
  }

  step(deltaMs: number): void {
    if (!this.engine) return;
    // 고정 타임스텝(16.6667ms) 서브스텝으로 안정화
    const fixed = 1000 / 60; // 16.6667ms
    const maxSteps = 4;
    this.accumulatorMs += Math.max(0, Math.min(100, deltaMs));
    let steps = 0;
    while (this.accumulatorMs >= fixed && steps < maxSteps) {
      // 풀링: 제약 길이를 서서히 줄여 당김
      if (this.ropeConstraint && this.pullRatePerSec > 0 && this.ropeAnchor && this.playerBody) {
        const dx = this.playerBody.position.x - this.ropeAnchor.x;
        const dy = this.playerBody.position.y - this.ropeAnchor.y;
        const dist = Math.max(10, Math.hypot(dx, dy));
        const dl = (this.pullRatePerSec * fixed) / 1000;
        const newLen = Math.max(10, dist - dl);
        this.ropeConstraint.length = newLen;
      }
      Engine.update(this.engine, fixed);
      this.accumulatorMs -= fixed;
      steps++;
    }
  }

  getRopeAnchor(): { x: number; y: number } | null { return this.ropeAnchor; }
  getRopeLength(): number | null { return this.ropeConstraint ? this.ropeConstraint.length : null; }
}

export const physicsSystem = new PhysicsSystem();


