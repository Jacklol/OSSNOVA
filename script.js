const introMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const introDemoButton = document.querySelector("[data-intro-demo='1']");
let introCleanupTimer = 0;

const stopHomeIntro = () => {
  window.clearTimeout(introCleanupTimer);
  introCleanupTimer = 0;
  document.body.classList.remove("home-intro");
};

const startHomeIntro = () => {
  if (introMotionPreference.matches) {
    stopHomeIntro();
    return;
  }

  stopHomeIntro();
  void document.body.offsetWidth;
  document.body.classList.add("home-intro");
  window.dispatchEvent(new CustomEvent("home-intro:start"));
  introCleanupTimer = window.setTimeout(stopHomeIntro, 2800);
};

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("is-nav-open", !isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
    });
  });
}

if (introDemoButton) {
  introDemoButton.addEventListener("click", () => {
    startHomeIntro();

    if (navToggle && siteNav) {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
    }
  });
}

const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const track = carousel.querySelector(".solution-track");
  const slides = Array.from(carousel.querySelectorAll(".solution-card"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  let current = 0;

  const updateCarousel = (index) => {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === current);
      dot.setAttribute("aria-current", dotIndex === current ? "true" : "false");
    });
  };

  prev.addEventListener("click", () => updateCarousel(current - 1));
  next.addEventListener("click", () => updateCarousel(current + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => updateCarousel(Number(dot.dataset.carouselDot)));
  });
}

const heroWaterCanvas = document.querySelector("[data-hero-water]");

if (heroWaterCanvas) {
  const hero = heroWaterCanvas.closest(".hero");
  const heroImage = hero ? hero.querySelector(".hero-bg") : null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gl =
    heroWaterCanvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false }) ||
    heroWaterCanvas.getContext("experimental-webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
  const maxRipples = 14;
  const ripples = [];
  let animationFrame = 0;
  let dpr = 1;
  let canvasWidth = 1;
  let canvasHeight = 1;
  let lastRippleAt = 0;
  let lastX = 0;
  let lastY = 0;
  let ready = false;
  let introRipplesPlayed = false;

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;

    void main() {
      v_uv = a_uv;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    const int MAX_RIPPLES = 14;

    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_imageSize;
    uniform vec2 u_objectPosition;
    uniform float u_pixelRatio;
    uniform float u_time;
    uniform int u_rippleCount;
    uniform vec4 u_ripples[MAX_RIPPLES];

    varying vec2 v_uv;

    vec2 coverUv(vec2 uv) {
      float imageAspect = u_imageSize.x / u_imageSize.y;
      float canvasAspect = u_resolution.x / u_resolution.y;
      vec2 covered = uv;

      if (imageAspect > canvasAspect) {
        float visibleWidth = canvasAspect / imageAspect;
        covered.x = u_objectPosition.x * (1.0 - visibleWidth) + covered.x * visibleWidth;
      } else {
        float visibleHeight = imageAspect / canvasAspect;
        covered.y = u_objectPosition.y * (1.0 - visibleHeight) + covered.y * visibleHeight;
      }

      covered.x = 1.0 - covered.x;
      return covered;
    }

    void main() {
      vec2 pixel = v_uv * u_resolution;
      vec2 offset = vec2(0.0);
      float highlight = 0.0;
      float shade = 0.0;

      for (int i = 0; i < MAX_RIPPLES; i++) {
        if (i >= u_rippleCount) {
          break;
        }

        vec4 ripple = u_ripples[i];
        float age = u_time - ripple.z;

        if (age <= 0.0 || age >= 1.35) {
          continue;
        }

        vec2 delta = pixel - ripple.xy;
        float distanceToCenter = max(length(delta), 0.001);
        float radius = age * 138.0;
        float fade = 1.0 - age / 1.35;
        float ring = exp(-pow((distanceToCenter - radius) / 26.0, 2.0));
        float inner = exp(-pow(distanceToCenter / 72.0, 2.0)) * fade * 0.35;
        float wave = sin((distanceToCenter - radius) * 0.13) * ring * fade * ripple.w;
        float distortion = 23.0 * u_pixelRatio;
        vec2 direction = delta / distanceToCenter;

        offset += direction * wave * distortion;
        offset += direction * inner * -8.0 * u_pixelRatio * ripple.w;
        highlight += ring * fade * ripple.w;
        shade += inner * ripple.w;
      }

      vec2 sampleUv = coverUv(v_uv + offset / u_resolution);
      vec4 color = texture2D(u_image, clamp(sampleUv, vec2(0.001), vec2(0.999)));
      float waterDepth = smoothstep(0.0, 1.0, v_uv.x * 0.62 + (1.0 - v_uv.y) * 0.38);
      vec3 waterTint = mix(vec3(0.9, 0.97, 1.0), vec3(0.5, 0.8, 0.94), waterDepth);

      color.rgb = mix(color.rgb, waterTint, 0.035 + waterDepth * 0.055);

      color.rgb += vec3(0.08, 0.18, 0.24) * min(highlight, 1.0) * 0.38;
      color.rgb -= vec3(0.03, 0.06, 0.08) * min(shade, 1.0) * 0.18;

      gl_FragColor = color;
    }
  `;

  const createShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram = () => {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  const readPositionRatio = (value, fallback = 0.5) => {
    if (!value) {
      return fallback;
    }

    const lower = value.toLowerCase();
    if (lower.includes("left") || lower.includes("top")) {
      return 0;
    }
    if (lower.includes("right") || lower.includes("bottom")) {
      return 1;
    }
    if (lower.includes("%")) {
      return Math.min(1, Math.max(0, parseFloat(lower) / 100));
    }

    return fallback;
  };

  const program = gl && createProgram();

  if (gl && program && hero && heroImage) {
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
    const objectPositionLocation = gl.getUniformLocation(program, "u_objectPosition");
    const pixelRatioLocation = gl.getUniformLocation(program, "u_pixelRatio");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const rippleCountLocation = gl.getUniformLocation(program, "u_rippleCount");
    const ripplesLocation = gl.getUniformLocation(program, "u_ripples[0]");
    const imageLocation = gl.getUniformLocation(program, "u_image");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    const vertices = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]);
    const rippleUniforms = new Float32Array(maxRipples * 4);

    const resizeWater = () => {
      const rect = heroWaterCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.75);
      canvasWidth = Math.max(1, Math.round(rect.width * dpr));
      canvasHeight = Math.max(1, Math.round(rect.height * dpr));

      if (heroWaterCanvas.width !== canvasWidth || heroWaterCanvas.height !== canvasHeight) {
        heroWaterCanvas.width = canvasWidth;
        heroWaterCanvas.height = canvasHeight;
      }

      gl.viewport(0, 0, canvasWidth, canvasHeight);
    };

    const uploadTexture = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heroImage);
    };

    const updateObjectPosition = () => {
      const position = getComputedStyle(heroImage).objectPosition.split(/\s+/);
      gl.uniform2f(
        objectPositionLocation,
        readPositionRatio(position[0], 0.5),
        readPositionRatio(position[1], 0.5)
      );
    };

    const drawWater = (timestamp = performance.now()) => {
      if (!ready || reducedMotion.matches) {
        animationFrame = 0;
        return;
      }

      const time = timestamp * 0.001;

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        if (time - ripples[index].born > 1.35) {
          ripples.splice(index, 1);
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(imageLocation, 0);
      gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight);
      gl.uniform2f(imageSizeLocation, heroImage.naturalWidth, heroImage.naturalHeight);
      gl.uniform1f(pixelRatioLocation, dpr);
      updateObjectPosition();
      gl.uniform1f(timeLocation, time);
      gl.uniform1i(rippleCountLocation, ripples.length);

      rippleUniforms.fill(0);
      ripples.forEach((ripple, index) => {
        const offset = index * 4;
        rippleUniforms[offset] = ripple.x;
        rippleUniforms[offset + 1] = ripple.y;
        rippleUniforms[offset + 2] = ripple.born;
        rippleUniforms[offset + 3] = ripple.strength;
      });
      gl.uniform4fv(ripplesLocation, rippleUniforms);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrame = ripples.length > 0 ? window.requestAnimationFrame(drawWater) : 0;
    };

    const startWater = () => {
      if (!animationFrame && ready && !reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(drawWater);
      }
    };

    const addRipple = (clientX, clientY, strength = 1) => {
      if (!ready || reducedMotion.matches) {
        return;
      }

      const rect = heroWaterCanvas.getBoundingClientRect();
      const x = (clientX - rect.left) * dpr;
      const y = (rect.bottom - clientY) * dpr;

      ripples.push({
        x,
        y,
        born: performance.now() * 0.001,
        strength: Math.min(strength, window.innerWidth < 700 ? 0.72 : 1),
      });

      if (ripples.length > maxRipples) {
        ripples.shift();
      }

      startWater();
    };

    const playIntroRipples = () => {
      if (!document.body.classList.contains("home-intro") || introRipplesPlayed || reducedMotion.matches || !ready) {
        return;
      }

      introRipplesPlayed = true;
      [
        { x: 0.1, y: 0.78, strength: 0.95, delay: 220 },
        { x: 0.28, y: 0.68, strength: 1, delay: 360 },
        { x: 0.5, y: 0.58, strength: 0.98, delay: 500 },
        { x: 0.72, y: 0.48, strength: 0.9, delay: 650 },
        { x: 0.9, y: 0.38, strength: 0.82, delay: 820 },
        { x: 0.38, y: 0.34, strength: 0.72, delay: 980 },
      ].forEach((ripple) => {
        window.setTimeout(() => {
          if (!ready) {
            return;
          }

          const rect = heroWaterCanvas.getBoundingClientRect();
          addRipple(
            rect.left + rect.width * ripple.x,
            rect.top + rect.height * ripple.y,
            ripple.strength
          );
        }, ripple.delay);
      });
    };

    const bootWater = () => {
      if (reducedMotion.matches) {
        return;
      }

      resizeWater();
      uploadTexture();
      ready = true;
      hero.classList.add("is-water-ready");
      drawWater();
      playIntroRipples();
    };

    window.addEventListener("home-intro:start", () => {
      introRipplesPlayed = false;
      playIntroRipples();
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

    window.addEventListener("resize", () => {
      if (!ready) {
        return;
      }

      resizeWater();
      drawWater();
    }, { passive: true });

    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      const now = performance.now();
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);

      if (now - lastRippleAt > 46 && distance > 7) {
        addRipple(event.clientX, event.clientY, 0.7 + Math.min(distance / 90, 0.35));
        lastRippleAt = now;
        lastX = event.clientX;
        lastY = event.clientY;
      }
    }, { passive: true });

    hero.addEventListener("pointerenter", (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      addRipple(event.clientX, event.clientY, 0.72);
    }, { passive: true });

    hero.addEventListener("pointerdown", (event) => {
      addRipple(event.clientX, event.clientY, 1);
    }, { passive: true });

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        hero.classList.remove("is-water-ready");
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      } else if (ready) {
        hero.classList.add("is-water-ready");
        drawWater();
      }
    };

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", handleMotionPreference);
    } else if (typeof reducedMotion.addListener === "function") {
      reducedMotion.addListener(handleMotionPreference);
    }

    heroWaterCanvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      ready = false;
      hero.classList.remove("is-water-ready");
    });

    if (heroImage.complete && heroImage.naturalWidth) {
      bootWater();
    } else {
      heroImage.addEventListener("load", bootWater, { once: true });
    }
  }
}

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = contactForm.querySelector(".form-status");
    status.textContent = "Запрос подготовлен. Подключите обработчик формы для отправки данных.";
  });
}
