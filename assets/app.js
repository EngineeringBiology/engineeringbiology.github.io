(function () {
  "use strict";
  var root = document.documentElement;

  var toggle = document.querySelector(".theme");
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (toggle) toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }
  if (toggle) {
    applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("eb-theme", next); } catch (e) {}
    });
  }

  var masthead = document.querySelector(".masthead");
  var menuBtn = document.querySelector(".menu");
  var nav = document.querySelector(".nav");
  function closeMenu() {
    if (!masthead || !menuBtn || !nav) return;
    masthead.classList.remove("is-open");
    nav.classList.remove("is-panel");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  if (masthead && menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = masthead.classList.toggle("is-open");
      nav.classList.toggle("is-panel", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    document.addEventListener("click", function (e) {
      if (masthead.classList.contains("is-open") && !masthead.contains(e.target)) closeMenu();
    });
  }
})();

/* -------------------------------------------------
   Инженерный цикл: WebGL-визуализация 7 стадий.
   Тексты стадий берутся из data-* атрибутов табов,
   поэтому компонент работает и для RU, и для EN.
------------------------------------------------- */
(function () {
  "use strict";

  var root = document.querySelector("#eb-cycle");
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = "1";

  var canvas = root.querySelector(".eb-cycle__canvas");
  var tabs = Array.prototype.slice.call(root.querySelectorAll(".eb-cycle__tab"));

  var eyebrowEl = root.querySelector(".eb-cycle__eyebrow");
  var titleEl = root.querySelector(".eb-cycle__title");
  var descriptionEl = root.querySelector(".eb-cycle__description");
  var counterEl = root.querySelector(".eb-cycle__counter");
  var pauseEl = root.querySelector(".eb-cycle__pause");
  var progressEl = root.querySelector(".eb-cycle__progress > span");
  var experimentLabelsEl = root.querySelector(".eb-cycle__experiment-labels");

  var STAGES = tabs.map(function (tab) {
    return {
      eyebrow: tab.getAttribute("data-eyebrow") || "",
      title: tab.getAttribute("data-title") || "",
      description: tab.getAttribute("data-description") || ""
    };
  });

  if (!canvas || !STAGES.length) return;

  var activeStage = 0;
  var previousStage = 0;
  var nextStage = 0;

  var transitionStartedAt = performance.now();
  var lastStageChange = performance.now();

  var AUTO_INTERVAL = 4000;
  var TRANSITION_DURATION = 650;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reducedMotion;
  var interactionX = 0.56;

  if (pauseEl) {
    pauseEl.textContent = playing ? "\u2161" : "\u25B6";
    if (pauseEl.getAttribute("data-label-pause")) {
      pauseEl.setAttribute("aria-label", playing ? pauseEl.getAttribute("data-label-pause") : pauseEl.getAttribute("data-label-play"));
    }
  }

  function setStage(index) {
    index = (index + STAGES.length) % STAGES.length;

    previousStage = nextStage;
    nextStage = index;
    activeStage = index;

    transitionStartedAt = performance.now();
    lastStageChange = transitionStartedAt;

    tabs.forEach(function (tab, i) {
      var active = i === activeStage;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    var stage = STAGES[index];

    eyebrowEl.textContent = stage.eyebrow;
    titleEl.textContent = stage.title;
    descriptionEl.textContent = stage.description;

    counterEl.textContent = String(index + 1).padStart(2, "0") + " / " + String(STAGES.length).padStart(2, "0");
    progressEl.style.transform = "translateX(" + index * 100 + "%)";

    experimentLabelsEl.classList.toggle("is-visible", index === 4);

    if (window.matchMedia("(max-width: 720px)").matches && tabs[index]) {
      tabs[index].scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setStage(Number(tab.dataset.stage));
    });
  });

  pauseEl.addEventListener("click", function () {
    playing = !playing;
    pauseEl.textContent = playing ? "\u2161" : "\u25B6";
    pauseEl.setAttribute("aria-label", playing ? pauseEl.getAttribute("data-label-pause") : pauseEl.getAttribute("data-label-play"));
    lastStageChange = performance.now();
  });

  function handlePointer(event) {
    var rect = canvas.getBoundingClientRect();
    interactionX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    if (activeStage === 3) lastStageChange = performance.now();
  }
  canvas.addEventListener("pointermove", handlePointer);
  canvas.addEventListener("pointerdown", handlePointer);

  /* theme colors */
  function parseCssColor(value) {
    var probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.color = value;
    document.body.appendChild(probe);
    var computed = getComputedStyle(probe).color;
    probe.remove();
    var parts = computed.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return [1, 1, 1];
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
  }

  function getThemeColors() {
    var style = getComputedStyle(root);
    function c(name) { return parseCssColor(style.getPropertyValue(name).trim()); }
    return {
      background: c("--eb-bg"),
      surface: c("--eb-surface"),
      foreground: c("--eb-text"),
      muted: c("--eb-muted"),
      observed: c("--eb-observed"),
      predicted: c("--eb-predicted"),
      error: c("--eb-error")
    };
  }

  /* -------------------------------------------------
     WEBGL
  ------------------------------------------------- */
  var gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return;

  var vertexShaderSource = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  var fragmentShaderSource = `
    precision mediump float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uFromStage;
    uniform float uToStage;
    uniform float uTransition;
    uniform float uInteraction;
    uniform float uMobile;

    uniform vec3 uBackground;
    uniform vec3 uSurface;
    uniform vec3 uForeground;
    uniform vec3 uMuted;
    uniform vec3 uObserved;
    uniform vec3 uPredicted;
    uniform vec3 uError;

    float saturate(float x) { return clamp(x, 0.0, 1.0); }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float sdBox(vec2 p, vec2 center, vec2 halfSize, float radius) {
      vec2 q = abs(p - center) - halfSize + radius;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    }

    float sdSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }

    float fillShape(float distance, float feather) {
      return 1.0 - smoothstep(0.0, feather, distance);
    }

    float strokeShape(float distance, float width) {
      return 1.0 - smoothstep(width, width + 0.004, abs(distance));
    }

    vec3 baseBackground(vec2 uv) {
      vec3 color = uBackground;
      float vignette = 1.0 - 0.055 * dot(uv, uv);
      return color * vignette;
    }

    vec2 sceneOffset() {
      return mix(vec2(0.34, 0.0), vec2(0.04, -0.18), uMobile);
    }

    vec2 sceneScale(vec2 p) {
      float scale = mix(1.0, 0.82, uMobile);
      return p / scale;
    }

    vec3 renderData(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());
      float progress = fract(uTime * 0.14);

      for (int row = 0; row < 5; row++) {
        float fr = float(row);
        float y = 0.28 - fr * 0.135;
        float maxWidth = 0.20 + 0.04 * sin(fr * 1.7);
        float backgroundBar = sdBox(p, vec2(-0.34 + maxWidth * 0.5, y), vec2(maxWidth * 0.5, 0.015), 0.007);
        color += uForeground * fillShape(backgroundBar, 0.004) * 0.07;
        float value = 0.05 + (0.05 + 0.13 * hash(vec2(fr, 2.0))) * (0.72 + 0.18 * sin(uTime * 1.4 + fr));
        float valueBar = sdBox(p, vec2(-0.34 + value * 0.5, y), vec2(value * 0.5, 0.010), 0.005);
        color += uObserved * fillShape(valueBar, 0.003) * 0.62;
      }

      for (int iy = 0; iy < 5; iy++) {
        for (int ix = 0; ix < 7; ix++) {
          float fx = float(ix);
          float fy = float(iy);
          vec2 cellCenter = vec2(0.03 + fx * 0.065, -0.29 + fy * 0.065);
          float cell = sdBox(p, cellCenter, vec2(0.026), 0.005);
          float value = hash(vec2(fx, fy) * 1.71);
          float order = (fx + fy * 0.25) / 8.5;
          float visible = smoothstep(0.0, 0.40, progress - order);
          vec3 cellColor = mix(uSurface, uObserved, value);
          color += cellColor * fillShape(cell, 0.003) * (0.22 + 0.58 * visible);
        }
      }
      return color;
    }

    vec3 renderModel(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());

      for (int iy = 0; iy < 5; iy++) {
        for (int ix = 0; ix < 5; ix++) {
          float fx = float(ix);
          float fy = float(iy);
          vec2 center = vec2(-0.38 + fx * 0.07, -0.14 + fy * 0.07);
          float cell = sdBox(p, center, vec2(0.025), 0.005);
          float value = hash(vec2(fx, fy) * 2.3);
          color += mix(uSurface, uObserved, value) * fillShape(cell, 0.003) * 0.50;
        }
      }

      float travelling = fract(uTime * 0.20);

      for (int row = 0; row < 4; row++) {
        float fr = float(row);
        float y = -0.21 + fr * 0.14;
        vec2 start = vec2(-0.03, y);
        vec2 end = vec2(0.16, y);
        float line = sdSegment(p, start, end);
        color += uForeground * exp(-line * 75.0) * 0.08;
        vec2 pulseCenter = mix(start, end, fract(travelling + fr * 0.18));
        float pulse = exp(-dot(p - pulseCenter, p - pulseCenter) * 420.0);
        color += uPredicted * pulse * 0.60;
        vec2 parameterCenter = vec2(0.31, y);
        float parameterFrame = sdBox(p, parameterCenter, vec2(0.13, 0.035), 0.009);
        color += uForeground * fillShape(parameterFrame, 0.003) * 0.06;
        float parameterValue = 0.055 + 0.11 * hash(vec2(fr, 4.0));
        float parameterBar = sdBox(p, vec2(0.18 + parameterValue * 0.5, y), vec2(parameterValue * 0.5, 0.010), 0.005);
        color += uPredicted * fillShape(parameterBar, 0.003) * 0.62;
      }
      return color;
    }

    vec3 renderPrediction(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());
      float nowX = -0.02;

      float nowLine = strokeShape(sdBox(p, vec2(nowX, 0.0), vec2(0.001, 0.29), 0.0), 0.001);
      color += uForeground * nowLine * 0.11;

      float historyY = 0.08 * sin((p.x + 0.36) * 7.0) - 0.05 * (p.x + 0.36);
      float history = abs(p.y - historyY);
      history += step(nowX, p.x) * 10.0;
      color += uForeground * exp(-history * 85.0) * 0.48;

      float predictedY = -0.05 - 0.18 * (p.x - nowX) + 0.035 * sin((p.x - nowX) * 9.0);
      float prediction = abs(p.y - predictedY);
      prediction += step(p.x, nowX) * 10.0;
      color += uPredicted * exp(-prediction * 95.0) * 0.86;

      float futureProgress = saturate((p.x - nowX) / 0.42);
      float uncertainty = 0.025 + 0.16 * futureProgress;
      float insideBand = smoothstep(uncertainty, uncertainty - 0.012, abs(p.y - predictedY)) * step(nowX, p.x);
      color += uPredicted * insideBand * 0.10;
      return color;
    }

    vec3 renderIntervention(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());
      float interaction = saturate((uInteraction - 0.43) / 0.50);

      float track = sdBox(p, vec2(-0.21, 0.13), vec2(0.23, 0.011), 0.009);
      color += uForeground * fillShape(track, 0.003) * 0.09;

      vec2 knobCenter = vec2(-0.44 + interaction * 0.46, 0.13);
      float knob = exp(-dot(p - knobCenter, p - knobCenter) * 430.0);
      color += uObserved * knob * 0.95;

      float baselineY = -0.12 - 0.04 * (p.x - 0.05);
      float baseline = abs(p.y - baselineY);
      color += uForeground * exp(-baseline * 90.0) * 0.14;

      float angle = -0.08 - 0.27 * interaction;
      float changedY = -0.12 + angle * (p.x - 0.05);
      float changed = abs(p.y - changedY);
      color += uObserved * exp(-changed * 98.0) * 0.78;

      float impact = exp(-pow(p.x - 0.08, 2.0) * 30.0) * exp(-pow(p.y + 0.11, 2.0) * 38.0);
      color += uError * impact * 0.34 * interaction;
      return color;
    }

    vec3 renderExperiment(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());
      float scanProgress = fract(uTime * 0.16);

      for (int group = 0; group < 2; group++) {
        float fg = float(group);
        float centerX = -0.19 + fg * 0.44;

        float groupFrame = sdBox(p, vec2(centerX, 0.0), vec2(0.18, 0.235), 0.024);
        color += uForeground * strokeShape(groupFrame, 0.002) * 0.13;

        for (int row = 0; row < 3; row++) {
          for (int column = 0; column < 4; column++) {
            float fr = float(row);
            float fc = float(column);
            vec2 wellCenter = vec2(centerX - 0.115 + fc * 0.077, -0.115 + fr * 0.115);
            float wellOutline = length(p - wellCenter) - 0.030;
            color += uForeground * strokeShape(wellOutline, 0.002) * 0.16;

            float baseResponse = 0.18 + 0.08 * sin(fc * 1.7 + fr * 1.2);
            float measuredResponse = group == 0 ? baseResponse : baseResponse + 0.28 + 0.08 * sin(fc * 0.8 + fr * 1.9);
            float responseRadius = 0.010 + 0.012 * measuredResponse;
            float response = length(p - wellCenter) - responseRadius;
            vec3 responseColor = mix(uObserved, uPredicted, fg * 0.22);
            color += responseColor * fillShape(response, 0.003) * (0.55 + measuredResponse * 0.55);
          }
        }

        float scanY = 0.19 - scanProgress * 0.38;
        float scan = exp(-pow(p.y - scanY, 2.0) * 1100.0) * step(centerX - 0.16, p.x) * step(p.x, centerX + 0.16);
        color += uObserved * scan * 0.32;

        for (int repeat = 0; repeat < 4; repeat++) {
          float frep = float(repeat);
          vec2 repeatCenter = vec2(centerX - 0.105 + frep * 0.07, -0.205);
          float dot_ = length(p - repeatCenter) - 0.008;
          float completed = step(frep / 4.0, scanProgress);
          color += mix(uMuted, uObserved, completed) * fillShape(dot_, 0.003) * 0.55;
        }
      }
      return color;
    }

    vec3 renderComparison(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());

      for (int side = 0; side < 2; side++) {
        float fs = float(side);
        vec2 origin = vec2(-0.39 + fs * 0.48, -0.21);
        for (int row = 0; row < 6; row++) {
          for (int column = 0; column < 6; column++) {
            float fr = float(row);
            float fc = float(column);
            float predicted = hash(vec2(fc, fr) * 1.9);
            float measured = saturate(predicted + 0.22 * sin(fc * 1.4 + fr * 0.7));
            float value = side == 0 ? predicted : measured;
            vec2 cellCenter = origin + vec2(fc * 0.055, fr * 0.055);
            float cell = sdBox(p, cellCenter, vec2(0.023), 0.004);
            color += mix(uSurface, uObserved, value) * fillShape(cell, 0.003) * 0.68;
          }
        }
      }

      for (int row = 0; row < 6; row++) {
        for (int column = 0; column < 3; column++) {
          float fr = float(row);
          float fc = float(column);
          float predicted = hash(vec2(fc, fr) * 2.7);
          float measured = saturate(predicted + 0.22 * sin(fc * 1.7 + fr));
          float delta = abs(predicted - measured);
          vec2 cellCenter = vec2(-0.055 + fc * 0.037, -0.21 + fr * 0.055);
          float cell = sdBox(p, cellCenter, vec2(0.014), 0.003);
          color += uError * fillShape(cell, 0.003) * delta * 1.8;
        }
      }
      return color;
    }

    vec3 renderUpdate(vec2 uv) {
      vec3 color = baseBackground(uv);
      vec2 p = sceneScale(uv - sceneOffset());

      for (int version = 0; version < 2; version++) {
        float fv = float(version);
        float centerX = -0.27 + fv * 0.48;
        float frame = sdBox(p, vec2(centerX, 0.0), vec2(0.17, 0.24), 0.02);
        color += mix(uForeground, uObserved, fv) * strokeShape(frame, 0.002) * 0.12;

        for (int parameter = 0; parameter < 4; parameter++) {
          float fp = float(parameter);
          float valueV1 = 0.08 + 0.14 * hash(vec2(fp, 2.0));
          float valueV2 = 0.08 + 0.14 * hash(vec2(fp, 5.0));
          float value = version == 0 ? valueV1 : valueV2;
          float y = 0.14 - fp * 0.09;
          float backgroundBar = sdBox(p, vec2(centerX, y), vec2(0.12, 0.015), 0.008);
          color += uForeground * fillShape(backgroundBar, 0.003) * 0.055;
          float valueBar = sdBox(p, vec2(centerX - 0.12 + value * 0.5, y), vec2(value * 0.5, 0.010), 0.005);
          color += mix(uForeground, uObserved, fv) * fillShape(valueBar, 0.003) * (0.30 + 0.24 * fv);
        }
      }

      float arrow = sdSegment(p, vec2(-0.05, 0.0), vec2(0.05, 0.0));
      color += uObserved * exp(-arrow * 90.0) * 0.30;

      float travelling = fract(uTime * 0.33);
      vec2 pulseCenter = mix(vec2(-0.05, 0.0), vec2(0.05, 0.0), travelling);
      float pulse = exp(-dot(p - pulseCenter, p - pulseCenter) * 700.0);
      color += uObserved * pulse * 0.72;
      return color;
    }

    vec3 renderScene(float stage, vec2 uv) {
      if (stage < 0.5) return renderData(uv);
      if (stage < 1.5) return renderModel(uv);
      if (stage < 2.5) return renderPrediction(uv);
      if (stage < 3.5) return renderIntervention(uv);
      if (stage < 4.5) return renderExperiment(uv);
      if (stage < 5.5) return renderComparison(uv);
      return renderUpdate(uv);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float transition = smoothstep(0.0, 1.0, uTransition);
      vec3 previous = renderScene(uFromStage, uv);
      vec3 next = renderScene(uToStage, uv);
      vec3 color = mix(previous, next, transition);
      float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.005;
      color += grain;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  var vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return;

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  var positionLocation = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  var uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    fromStage: gl.getUniformLocation(program, "uFromStage"),
    toStage: gl.getUniformLocation(program, "uToStage"),
    transition: gl.getUniformLocation(program, "uTransition"),
    interaction: gl.getUniformLocation(program, "uInteraction"),
    mobile: gl.getUniformLocation(program, "uMobile"),
    background: gl.getUniformLocation(program, "uBackground"),
    surface: gl.getUniformLocation(program, "uSurface"),
    foreground: gl.getUniformLocation(program, "uForeground"),
    muted: gl.getUniformLocation(program, "uMuted"),
    observed: gl.getUniformLocation(program, "uObserved"),
    predicted: gl.getUniformLocation(program, "uPredicted"),
    error: gl.getUniformLocation(program, "uError")
  };

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();

  var theme = getThemeColors();
  var themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  function refreshTheme() { theme = getThemeColors(); }
  if (themeMedia.addEventListener) themeMedia.addEventListener("change", refreshTheme);
  new MutationObserver(refreshTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"]
  });

  function setVec3(location, value) {
    gl.uniform3f(location, value[0], value[1], value[2]);
  }

  var animationStartedAt = performance.now();

  function render(now) {
    if (playing && now - lastStageChange > AUTO_INTERVAL) {
      setStage(activeStage + 1);
    }

    var transition = Math.min(1, (now - transitionStartedAt) / TRANSITION_DURATION);
    var mobile = window.matchMedia("(max-width: 720px)").matches ? 1 : 0;

    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, (now - animationStartedAt) / 1000);
    gl.uniform1f(uniforms.fromStage, previousStage);
    gl.uniform1f(uniforms.toStage, nextStage);
    gl.uniform1f(uniforms.transition, transition);
    gl.uniform1f(uniforms.interaction, interactionX);
    gl.uniform1f(uniforms.mobile, mobile);

    setVec3(uniforms.background, theme.background);
    setVec3(uniforms.surface, theme.surface);
    setVec3(uniforms.foreground, theme.foreground);
    setVec3(uniforms.muted, theme.muted);
    setVec3(uniforms.observed, theme.observed);
    setVec3(uniforms.predicted, theme.predicted);
    setVec3(uniforms.error, theme.error);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  setStage(0);
  requestAnimationFrame(render);
})();
