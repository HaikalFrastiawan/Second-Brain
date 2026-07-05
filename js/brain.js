// ===================================
// Brain Particle Visualization Engine
// ===================================

class BrainVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.targetPositions = [];
        this.mouseX = -1000;
        this.mouseY = -1000;
        this.isHovering = false;
        this.hoveredParticle = null;
        this.animationFrame = null;
        this.brainPath = null;
        this.dpr = window.devicePixelRatio || 1;

        this.categoryColors = {
            'Idea':      { r: 0,   g: 212, b: 255 },
            'Task':      { r: 255, g: 107, b: 53  },
            'Reference': { r: 168, g: 85,  b: 247 },
            'Learning':  { r: 34,  g: 197, b: 94  }
        };

        this.onParticleClick = null;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * this.dpr;
            this.mouseY = (e.clientY - rect.top) * this.dpr;
            this.isHovering = true;
            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = -1000;
            this.mouseY = -1000;
            this.isHovering = false;
            this.hoveredParticle = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoveredParticle && this.onParticleClick) {
                this.onParticleClick(this.hoveredParticle.noteId);
            }
        });

        this.animate();
    }

    resize() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;

        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.scale(this.dpr, this.dpr);

        this.displayWidth = w;
        this.displayHeight = h;
        this.centerX = w / 2;
        this.centerY = h / 2;
        this.scale = Math.min(w, h) / 340;

        this.generateBrainPath();
        this.regenerateTargets();
    }

    generateBrainPath() {
        const cx = this.centerX;
        const cy = this.centerY;
        const s = this.scale;

        this.brainPath = new Path2D();

        // Lateral (side) view of brain using bezier curves
        this.brainPath.moveTo(cx - 108*s, cy + 12*s);

        // Frontal lobe - rising curve
        this.brainPath.bezierCurveTo(
            cx - 122*s, cy - 25*s,
            cx - 112*s, cy - 72*s,
            cx - 78*s,  cy - 94*s
        );

        // Frontal to parietal
        this.brainPath.bezierCurveTo(
            cx - 48*s, cy - 112*s,
            cx - 8*s,  cy - 118*s,
            cx + 22*s, cy - 112*s
        );

        // Parietal lobe
        this.brainPath.bezierCurveTo(
            cx + 56*s,  cy - 105*s,
            cx + 84*s,  cy - 92*s,
            cx + 102*s, cy - 68*s
        );

        // Occipital lobe
        this.brainPath.bezierCurveTo(
            cx + 118*s, cy - 42*s,
            cx + 122*s, cy - 8*s,
            cx + 112*s, cy + 22*s
        );

        // Cerebellum bump
        this.brainPath.bezierCurveTo(
            cx + 108*s, cy + 38*s,
            cx + 98*s,  cy + 52*s,
            cx + 82*s,  cy + 60*s
        );

        // Below cerebellum
        this.brainPath.bezierCurveTo(
            cx + 62*s, cy + 68*s,
            cx + 35*s, cy + 72*s,
            cx + 8*s,  cy + 68*s
        );

        // Temporal lobe bottom
        this.brainPath.bezierCurveTo(
            cx - 22*s, cy + 64*s,
            cx - 52*s, cy + 55*s,
            cx - 72*s, cy + 42*s
        );

        // Return to start (brainstem area)
        this.brainPath.bezierCurveTo(
            cx - 88*s,  cy + 32*s,
            cx - 100*s, cy + 24*s,
            cx - 108*s, cy + 12*s
        );

        this.brainPath.closePath();

        // Internal sulcus lines for brain texture (stored separately)
        this.sulci = [];

        // Central sulcus
        this.sulci.push({
            points: [
                { x: cx - 10*s, y: cy - 110*s },
                { x: cx - 5*s,  y: cy - 80*s },
                { x: cx + 8*s,  y: cy - 40*s },
                { x: cx + 15*s, y: cy + 5*s }
            ]
        });

        // Lateral sulcus
        this.sulci.push({
            points: [
                { x: cx - 80*s, y: cy + 5*s },
                { x: cx - 40*s, y: cy - 8*s },
                { x: cx + 10*s, y: cy - 5*s },
                { x: cx + 50*s, y: cy + 15*s }
            ]
        });

        // Parieto-occipital sulcus
        this.sulci.push({
            points: [
                { x: cx + 60*s, y: cy - 90*s },
                { x: cx + 70*s, y: cy - 55*s },
                { x: cx + 75*s, y: cy - 20*s }
            ]
        });
    }

    regenerateTargets() {
        this.targetPositions = [];
        const maxPositions = 600;
        let attempts = 0;
        const maxAttempts = maxPositions * 30;

        const cx = this.centerX;
        const cy = this.centerY;
        const s = this.scale;

        while (this.targetPositions.length < maxPositions && attempts < maxAttempts) {
            const x = cx + (Math.random() - 0.5) * 250 * s;
            const y = cy + (Math.random() - 0.5) * 240 * s;

            if (this.ctx.isPointInPath(this.brainPath, x * this.dpr, y * this.dpr)) {
                this.targetPositions.push({ x, y });
            }
            attempts++;
        }

        // Shuffle
        for (let i = this.targetPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.targetPositions[i], this.targetPositions[j]] = [this.targetPositions[j], this.targetPositions[i]];
        }

        // Re-map existing particles
        this.particles.forEach((p, i) => {
            if (i < this.targetPositions.length) {
                p.targetX = this.targetPositions[i].x;
                p.targetY = this.targetPositions[i].y;
            }
        });
    }

    syncWithNotes(notes) {
        this.particles = [];
        notes.forEach(note => {
            const count = 3 + Math.floor(note.title.length / 8);
            this.addParticles(note, Math.min(count, 8));
        });
    }

    addParticles(note, count = 5) {
        const color = this.categoryColors[note.category] || this.categoryColors['Idea'];

        for (let i = 0; i < count; i++) {
            const posIndex = this.particles.length;

            if (posIndex >= this.targetPositions.length) {
                // Extend targets if needed
                let extra = 0;
                let att = 0;
                while (extra < 50 && att < 500) {
                    const x = this.centerX + (Math.random() - 0.5) * 250 * this.scale;
                    const y = this.centerY + (Math.random() - 0.5) * 240 * this.scale;
                    if (this.ctx.isPointInPath(this.brainPath, x * this.dpr, y * this.dpr)) {
                        this.targetPositions.push({ x, y });
                        extra++;
                    }
                    att++;
                }
            }

            const target = this.targetPositions[posIndex] || {
                x: this.centerX + (Math.random() - 0.5) * 150,
                y: this.centerY + (Math.random() - 0.5) * 120
            };

            this.particles.push({
                x: this.centerX + (Math.random() - 0.5) * this.displayWidth * 0.8,
                y: this.centerY + (Math.random() - 0.5) * this.displayHeight * 0.8,
                targetX: target.x,
                targetY: target.y,
                radius: 1.5 + Math.random() * 2,
                color: color,
                alpha: 0,
                targetAlpha: 0.55 + Math.random() * 0.45,
                phase: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.4,
                noteId: note.id,
                noteTitle: note.title,
                noteCategory: note.category
            });
        }
    }

    removeParticles(noteId) {
        this.particles = this.particles.filter(p => p.noteId !== noteId);
    }

    checkHover() {
        this.hoveredParticle = null;
        const mx = this.mouseX / this.dpr;
        const my = this.mouseY / this.dpr;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            const dx = mx - p.x;
            const dy = my - p.y;
            if (dx * dx + dy * dy < (p.radius + 10) * (p.radius + 10)) {
                this.hoveredParticle = p;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredParticle ? 'pointer' : 'default';
    }

    animate() {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

        const time = performance.now() * 0.001;

        // Draw brain outline (very subtle)
        ctx.save();
        if (this.particles.length === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 8]);
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
            ctx.lineWidth = 1;
        }
        ctx.stroke(this.brainPath);
        ctx.setLineDash([]);

        // Draw sulci (brain wrinkle lines)
        this.sulci.forEach(sulcus => {
            ctx.beginPath();
            ctx.moveTo(sulcus.points[0].x, sulcus.points[0].y);
            for (let i = 1; i < sulcus.points.length; i++) {
                ctx.lineTo(sulcus.points[i].x, sulcus.points[i].y);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.restore();

        // Draw connections between nearby particles
        if (this.particles.length > 0 && this.particles.length < 300) {
            this.drawConnections(ctx);
        }

        // Update and draw particles
        this.particles.forEach(p => {
            // Ease towards target
            p.x += (p.targetX - p.x) * 0.025;
            p.y += (p.targetY - p.y) * 0.025;

            // Floating animation
            const floatX = Math.sin(time * p.speed + p.phase) * 1.2;
            const floatY = Math.cos(time * p.speed * 0.7 + p.phase) * 1.2;

            // Mouse interaction
            let repelX = 0, repelY = 0;
            if (this.isHovering) {
                const mx = this.mouseX / this.dpr;
                const my = this.mouseY / this.dpr;
                const mdx = p.x - mx;
                const mdy = p.y - my;
                const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
                if (mDist < 55 && mDist > 0) {
                    const force = (55 - mDist) / 55 * 4;
                    repelX = (mdx / mDist) * force;
                    repelY = (mdy / mDist) * force;
                }
            }

            // Fade in
            p.alpha += (p.targetAlpha - p.alpha) * 0.03;

            const drawX = p.x + floatX + repelX;
            const drawY = p.y + floatY + repelY;
            const isHovered = this.hoveredParticle === p;

            // Glow
            const glowR = isHovered ? p.radius * 5 : p.radius * 2.5;
            const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowR);
            grad.addColorStop(0, `rgba(${p.color.r},${p.color.g},${p.color.b},${p.alpha * (isHovered ? 0.6 : 0.2)})`);
            grad.addColorStop(1, `rgba(${p.color.r},${p.color.g},${p.color.b},0)`);
            ctx.beginPath();
            ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(drawX, drawY, isHovered ? p.radius * 1.8 : p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${p.alpha})`;
            ctx.fill();
        });

        // Tooltip
        if (this.hoveredParticle) {
            this.drawTooltip(ctx, this.hoveredParticle);
        }

        // Empty state
        if (this.particles.length === 0) {
            this.drawEmptyState(ctx);
        }

        ctx.restore();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    drawConnections(ctx) {
        const maxDist = 35;
        const len = this.particles.length;
        ctx.save();
        ctx.lineWidth = 0.4;

        for (let i = 0; i < len; i++) {
            const a = this.particles[i];
            for (let j = i + 1; j < len; j++) {
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxDist * maxDist) {
                    const dist = Math.sqrt(distSq);
                    const alpha = (1 - dist / maxDist) * 0.08;
                    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    drawTooltip(ctx, p) {
        const mx = this.mouseX / this.dpr;
        const my = this.mouseY / this.dpr;
        const padding = 10;

        ctx.save();
        ctx.font = '600 12px Inter, sans-serif';
        const catWidth = ctx.measureText(p.noteCategory).width;
        ctx.font = '500 13px Inter, sans-serif';
        const titleWidth = ctx.measureText(p.noteTitle).width;
        const boxW = Math.max(catWidth, titleWidth) + padding * 2 + 4;
        const boxH = 48;

        let tx = mx + 16;
        let ty = my - boxH - 10;
        if (tx + boxW > this.displayWidth) tx = mx - boxW - 16;
        if (ty < 4) ty = my + 16;

        // Background
        ctx.fillStyle = 'rgba(12, 12, 30, 0.92)';
        ctx.beginPath();
        this.roundRect(ctx, tx, ty, boxW, boxH, 8);
        ctx.fill();

        // Border
        ctx.strokeStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},0.4)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Category
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},0.85)`;
        ctx.fillText(p.noteCategory, tx + padding, ty + 18);

        // Title
        ctx.font = '500 13px Inter, sans-serif';
        ctx.fillStyle = 'rgba(232, 232, 240, 0.9)';
        ctx.fillText(p.noteTitle, tx + padding, ty + 36);

        ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }

    drawEmptyState(ctx) {
        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '42px serif';
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillText('\uD83E\uDDE0', this.centerX, this.centerY - 10);

        ctx.font = '500 14px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText('Add notes to fill your brain with knowledge', this.centerX, this.centerY + 30);

        ctx.restore();
    }

    destroy() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        window.removeEventListener('resize', this.resize);
    }
}
