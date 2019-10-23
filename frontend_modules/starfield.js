/** @typedef {{ x: Number, y: Number }} Vector */

class Starfield {

    /** 
     * @param {HTMLCanvasElement} canvas 
     * @param {Object} options
     * @param {Number} [options.starNumber]
     * @param {Number} [options.startRadius]
     * @param {Number} [options.radiusIncrease]
     * @param {Number} [options.speedBase]
     * @param {Number} [options.speedRange]
     * @param {Number} [options.enterTime] enter phase time in seconds
     * @param {String} [options.color]
     * @param {Number} [options.alpha]
     * @param {Boolean} [options.halloween] Interesting
     */
    constructor (canvas, options) {

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        /** @type {Star[]} */
        this.stars = [];

        this.config = {
            starNumber: 220,
            startRadius: .1,
            radiusIncrease: .0035,
            speedBase: .4,
            speedRange: 3.3,
            enterTime: 0.55,
            color: "#00b8ff",
            alpha: .9,
            halloween: false,
        };

        Object.assign(this.config, options);

        if (this.config.halloween) {
            this.config.color = '#ffb13d';
        }

        this.resize();
        this.init();
    }

    init() {
        window.addEventListener("resize", () => this.resize());
    }

    start() {
        this.stars = Array.from({ length: this.config.starNumber })
                          .map(() => this.createStar());

        this.startTime = 0;
        this.lastUpdate = 0;

        this.stopped = false;
        this.render();
    }

    createStar() {
        if (this.config.halloween && Math.random() < 0.01) {
            return new Pumpkin(this, this.randomVector);
        }
        return new Star(this, this.randomVector);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    stop() {
        this.stopped = true;
    }

    render() {

        if (this.stopped) return;
        let now = window.performance && window.performance.now ? window.performance.now() : Date.now();

        if (!this.startTime) {
            this.startTime = this.lastUpdate = now;
        }

        let dt = (now - this.lastUpdate) / 6;

        let enterPhase = now - this.startTime - 1e3 * this.config.enterTime;

        if (enterPhase > 0) {
            let d = enterPhase / 1e3;

            if (d > 1.2) d = 1.2;

            dt /= Math.pow(3, d);
        }

        this.ctx.save();
        this.clear();
        this.ctx.translate(this.hwidth, this.hheight);
        this.update(dt);
        this.ctx.restore();

        requestAnimationFrame(timestamp => this.render(timestamp));
        this.lastUpdate = now;
    }

    /** @param {Number} */
    update(dt) {
        let ctx = this.ctx;

        ctx.beginPath();
        ctx.fillStyle = this.config.color;
        ctx.globalAlpha = this.config.alpha;
        this.stars.forEach((star, index) => {
            star.update(dt);
            if (star.isOutside)
                star = this.stars[index] = this.createStar();
            star.draw();
        });
        ctx.fill();
    } 

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.hwidth = this.width / 2;
        this.hheight = this.height / 2;
    }

    get randomVector() {
        return {
            x: Math.random() * this.width * 2 - this.width,
            y: Math.random() * this.height * 2 - this.height
        }
    }
}

class Star {

    /** 
     * @param {Starfield} field
     * @param {Vector} initVector
     */
    constructor(field, initVector) {

        this.field = field;
        this.spawn(initVector);
    }

    /** @param {Vector} */
    spawn(vector) {

        this.x = vector.x;
        this.y = vector.y;
        this.angle = Math.atan2(this.y, this.x);
        this.radius = this.field.config.startRadius;
        this.speed = this.field.config.speedBase + this.field.config.speedRange * Math.random();
    }

    /** @param {Number} dt delta time */
    update(dt) {

        let dist = this.speed * dt;
        this.x += Math.cos(this.angle) * dist;
        this.y += Math.sin(this.angle) * dist;
        this.radius += this.field.config.radiusIncrease * dist;
    }

    /** @param {Number} dt delta time */
    draw() {
        this.field.ctx.moveTo(this.x, this.y);
        this.field.ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    }

    get isOutside() {

        let xBound = this.field.hwidth + this.radius;
        let yBound = this.field.hheight + this.radius;

        return this.x < - xBound || this.x > xBound || this.y < - yBound || this.y > yBound;
    }
}

class Pumpkin extends Star {

    /** 
     * @param {Starfield} field
     * @param {Vector} initVector
     */
    constructor(field, initVector) {
        super(field, initVector);

        this.img = document.getElementById("pumpkin");
        this.rotation = this.angle;
        this.clockWise = Math.random() < 0.5;
        this.radius *= 500;
        this.alpha = 0;
        this.targeAlpha = 0.5 + Math.random() / 2;
    }

    update(dt) {
        super.update(dt);
        this.rotation += (this.clockWise ? 1 : -1) * dt / 100;
        this.alpha = Math.min(this.alpha + dt / 300, this.targeAlpha);
    }

    draw() {
        let ctx = this.field.ctx;

        ctx.save();

        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(this.img, -this.radius / 2, -this.radius / 2, this.radius, this.radius);

        ctx.restore();
    }
}

module.exports = Starfield;