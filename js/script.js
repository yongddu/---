// ASCII 코드 생성을 위한 문자 집합
const codeChars =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789(){}[]<>;:,._-+=!@#$%^&*|\\/\"'`~?";

// 스캐너의 왼쪽과 오른쪽 경계 계산 (화면 중앙)
const scannerLeft = window.innerWidth / 2 - 2;
const scannerRight = window.innerWidth / 2 + 2;

// 카드 스트림을 제어하는 메인 클래스
class CardStreamController {
  constructor() {
    // DOM 요소 참조
    this.container = document.getElementById("cardStream");
    this.cardLine = document.getElementById("cardLine");
    this.speedIndicator = document.getElementById("speedValue");

    // 카드 위치 및 이동 관련 변수
    this.position = 0; // 현재 카드의 X 위치
    this.velocity = 120; // 이동 속도 (픽셀/초)
    this.direction = -1; // 이동 방향 (-1: 왼쪽, 1: 오른쪽)
    this.isAnimating = true; // 애니메이션 활성화 상태
    this.isDragging = false; // 드래그 중인지 여부

    // 드래그 관련 변수
    this.lastTime = 0; // 마지막 프레임 시간
    this.lastMouseX = 0; // 마지막 마우스 X 위치
    this.mouseVelocity = 0; // 마우스 드래그 속도
    this.friction = 0.95; // 마찰 계수 (속도 감소율)
    this.minVelocity = 30; // 최소 속도

    // 컨테이너 크기 관련 변수
    this.containerWidth = 0; // 컨테이너 너비
    this.cardLineWidth = 0; // 전체 카드 라인의 너비

    this.init();
  }

  // 초기화 함수 - 모든 설정을 시작
  init() {
    this.populateCardLine(); // 카드 생성
    this.calculateDimensions(); // 크기 계산
    this.setupEventListeners(); // 이벤트 리스너 등록
    this.updateCardPosition(); // 초기 위치 설정
    this.animate(); // 애니메이션 시작
    this.startPeriodicUpdates(); // 주기적 업데이트 시작
  }

  // 컨테이너와 카드 라인의 크기를 계산
  calculateDimensions() {
    this.containerWidth = this.container.offsetWidth;
    const cardWidth = 400; // 카드 너비
    const cardGap = 60; // 카드 간격
    const cardCount = this.cardLine.children.length;
    this.cardLineWidth = (cardWidth + cardGap) * cardCount; // 전체 너비
  }

  // 마우스/터치 이벤트 리스너 설정
  setupEventListeners() {
    // 마우스 드래그 이벤트
    this.cardLine.addEventListener("mousedown", (e) => this.startDrag(e));
    document.addEventListener("mousemove", (e) => this.onDrag(e));
    document.addEventListener("mouseup", () => this.endDrag());

    // 터치 이벤트 (모바일)
    this.cardLine.addEventListener(
      "touchstart",
      (e) => this.startDrag(e.touches[0]),
      { passive: false }
    );
    document.addEventListener("touchmove", (e) => this.onDrag(e.touches[0]), {
      passive: false,
    });
    document.addEventListener("touchend", () => this.endDrag());

    // 마우스 휠 이벤트
    this.cardLine.addEventListener("wheel", (e) => this.onWheel(e));
    // 텍스트 선택 및 드래그 방지
    this.cardLine.addEventListener("selectstart", (e) => e.preventDefault());
    this.cardLine.addEventListener("dragstart", (e) => e.preventDefault());

    // 창 크기 변경 시 재계산
    window.addEventListener("resize", () => this.calculateDimensions());
  }

  // 드래그 시작 처리
  startDrag(e) {
    e.preventDefault();

    this.isDragging = true; // 드래그 상태 활성화
    this.isAnimating = false; // 자동 애니메이션 비활성화
    this.lastMouseX = e.clientX; // 현재 마우스 위치 저장
    this.mouseVelocity = 0; // 속도 초기화

    // 현재 transform 값에서 위치 추출
    const transform = window.getComputedStyle(this.cardLine).transform;
    if (transform !== "none") {
      const matrix = new DOMMatrix(transform);
      this.position = matrix.m41; // translateX 값
    }

    this.cardLine.style.animation = "none";
    this.cardLine.classList.add("dragging"); // 드래그 스타일 추가

    // 텍스트 선택 방지 및 커서 변경
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  // 드래그 중 처리
  onDrag(e) {
    if (!this.isDragging) return;
    e.preventDefault();

    const deltaX = e.clientX - this.lastMouseX; // 마우스 이동 거리
    this.position += deltaX; // 위치 업데이트
    this.mouseVelocity = deltaX * 60; // 속도 계산 (프레임당 -> 초당)
    this.lastMouseX = e.clientX;

    // 카드 위치 즉시 업데이트
    this.cardLine.style.transform = `translateX(${this.position}px)`;
    this.updateCardClipping(); // 스캐너 클리핑 업데이트
  }

  // 드래그 종료 처리
  endDrag() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.cardLine.classList.remove("dragging");

    // 드래그 속도에 따라 관성 적용
    if (Math.abs(this.mouseVelocity) > this.minVelocity) {
      this.velocity = Math.abs(this.mouseVelocity);
      this.direction = this.mouseVelocity > 0 ? 1 : -1;
    } else {
      this.velocity = 120; // 기본 속도로 복귀
    }

    this.isAnimating = true; // 자동 애니메이션 재개
    this.updateSpeedIndicator();

    // 스타일 복원
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  // 애니메이션 프레임 함수 (매 프레임마다 호출)
  animate() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 200; // 시간 간격 계산
    this.lastTime = currentTime;

    // 자동 애니메이션이 활성화되고 드래그 중이 아닐 때
    if (this.isAnimating && !this.isDragging) {
      // 마찰력 적용 (속도 감소)
      if (this.velocity > this.minVelocity) {
        this.velocity *= this.friction;
      } else {
        this.velocity = Math.max(this.minVelocity, this.velocity);
      }

      // 위치 업데이트: 속도 * 방향 * 시간
      this.position += this.velocity * this.direction * deltaTime;
      this.updateCardPosition();
      this.updateSpeedIndicator();
    }

    // 다음 프레임 요청 (60fps)
    requestAnimationFrame(() => this.animate());
  }

  // 카드 위치 업데이트 및 무한 루프 처리
  updateCardPosition() {
    const containerWidth = this.containerWidth;
    const cardLineWidth = this.cardLineWidth;

    // 무한 스크롤: 카드가 화면 밖으로 나가면 반대쪽에서 다시 나타남
    if (this.position < -cardLineWidth) {
      this.position = containerWidth;
    } else if (this.position > containerWidth) {
      this.position = -cardLineWidth;
    }

    // transform 적용
    this.cardLine.style.transform = `translateX(${this.position}px)`;
    this.updateCardClipping();
  }

  // 속도 표시 업데이트
  updateSpeedIndicator() {
    this.speedIndicator.textContent = Math.round(this.velocity);
  }

  // 애니메이션 일시정지/재생 토글
  toggleAnimation() {
    this.isAnimating = !this.isAnimating;
    const btn = document.querySelector(".control-btn");
    btn.textContent = this.isAnimating ? "Pause" : "Play";

    if (this.isAnimating) {
      this.cardLine.style.animation = "none";
    }
  }

  // 위치 및 속도 초기화
  resetPosition() {
    this.position = this.containerWidth;
    this.velocity = 120;
    this.direction = -1;
    this.isAnimating = true;
    this.isDragging = false;

    this.cardLine.style.animation = "none";
    this.cardLine.style.transform = `translateX(${this.position}px)`;
    this.cardLine.classList.remove("dragging");

    this.updateSpeedIndicator();

    const btn = document.querySelector(".control-btn");
    btn.textContent = "Pause";
  }

  // 이동 방향 반전
  changeDirection() {
    this.direction *= -1;
    this.updateSpeedIndicator();
  }

  // 마우스 휠로 스크롤
  onWheel(e) {
    e.preventDefault();

    const scrollSpeed = 20;
    const delta = e.deltaY > 0 ? scrollSpeed : -scrollSpeed;

    this.position += delta;
    this.updateCardPosition();
    this.updateCardClipping();
  }

  // 랜덤한 코드 문자열 생성 (ASCII 아트용)
  generateCode(width, height) {
    // 랜덤 정수 생성 헬퍼
    const randInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;
    // 배열에서 랜덤 요소 선택 헬퍼
    const pick = (arr) => arr[randInt(0, arr.length - 1)];

    // 가짜 코드 라이브러리 (시각 효과용)
    const header = [
      "// compiled preview • scanner demo",
      "/* generated for visual effect – not executed */",
      "const SCAN_WIDTH = 8;",
      "const FADE_ZONE = 35;",
      "const MAX_PARTICLES = 2500;",
      "const TRANSITION = 0.05;",
    ];

    const helpers = [
      "function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }",
      "function lerp(a, b, t) { return a + (b - a) * t; }",
      "const now = () => performance.now();",
      "function rng(min, max) { return Math.random() * (max - min) + min; }",
    ];

    const particleBlock = (idx) => [
      `class Particle${idx} {`,
      "  constructor(x, y, vx, vy, r, a) {",
      "    this.x = x; this.y = y;",
      "    this.vx = vx; this.vy = vy;",
      "    this.r = r; this.a = a;",
      "  }",
      "  step(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }",
      "}",
    ];

    const scannerBlock = [
      "const scanner = {",
      "  x: Math.floor(window.innerWidth / 2),",
      "  width: SCAN_WIDTH,",
      "  glow: 3.5,",
      "};",
      "",
      "function drawParticle(ctx, p) {",
      "  ctx.globalAlpha = clamp(p.a, 0, 1);",
      "  ctx.drawImage(gradient, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);",
      "}",
    ];

    const loopBlock = [
      "function tick(t) {",
      "  // requestAnimationFrame(tick);",
      "  const dt = 0.016;",
      "  // update & render",
      "}",
    ];

    const misc = [
      "const state = { intensity: 1.2, particles: MAX_PARTICLES };",
      "const bounds = { w: window.innerWidth, h: 300 };",
      "const gradient = document.createElement('canvas');",
      "const ctx = gradient.getContext('2d');",
      "ctx.globalCompositeOperation = 'lighter';",
      "// ascii overlay is masked with a 3-phase gradient",
    ];

    // 모든 코드 조각을 라이브러리에 추가
    const library = [];
    header.forEach((l) => library.push(l));
    helpers.forEach((l) => library.push(l));
    for (let b = 0; b < 3; b++)
      particleBlock(b).forEach((l) => library.push(l));
    scannerBlock.forEach((l) => library.push(l));
    loopBlock.forEach((l) => library.push(l));
    misc.forEach((l) => library.push(l));

    // 추가 변수 선언 생성
    for (let i = 0; i < 40; i++) {
      const n1 = randInt(1, 9);
      const n2 = randInt(10, 99);
      library.push(`const v${i} = (${n1} + ${n2}) * 0.${randInt(1, 9)};`);
    }
    // 추가 조건문 생성
    for (let i = 0; i < 20; i++) {
      library.push(
        `if (state.intensity > ${1 + (i % 3)}) { scanner.glow += 0.01; }`
      );
    }

    // 코드를 한 줄로 합치고 필요한 길이만큼 반복
    let flow = library.join(" ");
    flow = flow.replace(/\s+/g, " ").trim();
    const totalChars = width * height;
    while (flow.length < totalChars + width) {
      const extra = pick(library).replace(/\s+/g, " ").trim();
      flow += " " + extra;
    }

    // 지정된 너비와 높이로 코드를 나눔
    let out = "";
    let offset = 0;
    for (let row = 0; row < height; row++) {
      let line = flow.slice(offset, offset + width);
      if (line.length < width) line = line + " ".repeat(width - line.length);
      out += line + (row < height - 1 ? "\n" : "");
      offset += width;
    }
    return out;
  }

  // 카드 크기에 맞는 코드 크기 계산
  calculateCodeDimensions(cardWidth, cardHeight) {
    const fontSize = 11; // 폰트 크기
    const lineHeight = 13; // 줄 높이
    const charWidth = 6; // 문자 너비
    const width = Math.floor(cardWidth / charWidth); // 한 줄에 들어갈 문자 수
    const height = Math.floor(cardHeight / lineHeight); // 총 줄 수
    return { width, height, fontSize, lineHeight };
  }

  // 카드 래퍼 생성 (일반 카드 + ASCII 카드)
  createCardWrapper(index) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";

    // 일반 카드 (이미지)
    const normalCard = document.createElement("div");
    normalCard.className = "card card-normal";

    // 카드 이미지 배열
    const cardImages = [
      "./img/no.png",
      "./img/no1.png",
      "./img/no2.png",
      "./img/no3.png",
      "./img/no4.png",
    ];

    const cardImage = document.createElement("img");
    cardImage.className = "card-image";
    cardImage.src = cardImages[index % cardImages.length]; // 순환하며 이미지 선택
    cardImage.alt = "Credit Card";

    // 이미지 로드 실패 시 대체 이미지 생성
    cardImage.onerror = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 250;
      const ctx = canvas.getContext("2d");

      // 그라디언트 배경 생성
      const gradient = ctx.createLinearGradient(0, 0, 400, 250);
      gradient.addColorStop(0, "#667eea");
      gradient.addColorStop(1, "#764ba2");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 250);

      cardImage.src = canvas.toDataURL();
    };

    normalCard.appendChild(cardImage);

    // ASCII 코드 카드 (스캔 후 나타남)
    const asciiCard = document.createElement("div");
    asciiCard.className = "card card-ascii";

    const asciiContent = document.createElement("div");
    asciiContent.className = "ascii-content";

    // 코드 텍스트 생성 및 스타일 적용
    const { width, height, fontSize, lineHeight } =
      this.calculateCodeDimensions(400, 250);
    asciiContent.style.fontSize = fontSize + "px";
    asciiContent.style.lineHeight = lineHeight + "px";
    asciiContent.textContent = this.generateCode(width, height);

    asciiCard.appendChild(asciiContent);
    wrapper.appendChild(normalCard);
    wrapper.appendChild(asciiCard);

    return wrapper;
  }

  // 스캐너 위치에 따라 카드 클리핑 업데이트 (스캔 효과)
  updateCardClipping() {
    const scannerX = window.innerWidth / 2; // 스캐너 X 위치 (화면 중앙)
    const scannerWidth = 8; // 스캐너 너비
    const scannerLeft = scannerX - scannerWidth / 2;
    const scannerRight = scannerX + scannerWidth / 2;
    let anyScanningActive = false; // 스캔 중인 카드가 있는지

    // 모든 카드 확인
    document.querySelectorAll(".card-wrapper").forEach((wrapper) => {
      const rect = wrapper.getBoundingClientRect();
      const cardLeft = rect.left;
      const cardRight = rect.right;
      const cardWidth = rect.width;

      const normalCard = wrapper.querySelector(".card-normal");
      const asciiCard = wrapper.querySelector(".card-ascii");

      // 카드가 스캐너와 겹치는지 확인
      if (cardLeft < scannerRight && cardRight > scannerLeft) {
        anyScanningActive = true;
        // 겹치는 영역 계산
        const scannerIntersectLeft = Math.max(scannerLeft - cardLeft, 0);
        const scannerIntersectRight = Math.min(
          scannerRight - cardLeft,
          cardWidth
        );

        // 클리핑 비율 계산 (스캔된 부분은 ASCII로 전환)
        const normalClipRight = (scannerIntersectLeft / cardWidth) * 100;
        const asciiClipLeft = (scannerIntersectRight / cardWidth) * 100;

        normalCard.style.setProperty("--clip-right", `${normalClipRight}%`);
        asciiCard.style.setProperty("--clip-left", `${asciiClipLeft}%`);

        // 스캔 효과 애니메이션 추가 (처음 스캔될 때만)
        if (!wrapper.hasAttribute("data-scanned") && scannerIntersectLeft > 0) {
          wrapper.setAttribute("data-scanned", "true");
          const scanEffect = document.createElement("div");
          scanEffect.className = "scan-effect";
          wrapper.appendChild(scanEffect);
          // 0.6초 후 스캔 효과 제거
          setTimeout(() => {
            if (scanEffect.parentNode) {
              scanEffect.parentNode.removeChild(scanEffect);
            }
          }, 600);
        }
      } else {
        // 스캐너 밖에 있는 카드 처리
        if (cardRight < scannerLeft) {
          // 완전히 스캔된 카드 (왼쪽)
          normalCard.style.setProperty("--clip-right", "100%");
          asciiCard.style.setProperty("--clip-left", "100%");
        } else if (cardLeft > scannerRight) {
          // 아직 스캔되지 않은 카드 (오른쪽)
          normalCard.style.setProperty("--clip-right", "0%");
          asciiCard.style.setProperty("--clip-left", "0%");
        }
        wrapper.removeAttribute("data-scanned");
        if (cardRight < scannerLeft) {
          // 완전히 스캔된 카드 (왼쪽)
          normalCard.style.setProperty("--clip-right", "100%");
          asciiCard.style.setProperty("--clip-left", "100%");
        } else if (cardLeft > scannerRight) {
          // 아직 스캔되지 않은 카드 (오른쪽)
          normalCard.style.setProperty("--clip-right", "0%");
          asciiCard.style.setProperty("--clip-left", "0%");
        }
        wrapper.removeAttribute("data-scanned");
      }
    });

    // 스캐너 상태를 파티클 시스템에 전달
    if (window.setScannerScanning) {
      window.setScannerScanning(anyScanningActive);
    }
  }

  // ASCII 코드 내용을 주기적으로 업데이트 (글리치 효과)
  updateAsciiContent() {
    document.querySelectorAll(".ascii-content").forEach((content) => {
      if (Math.random() < 0.15) {
        // 15% 확률로 업데이트
        const { width, height } = this.calculateCodeDimensions(400, 250);
        content.textContent = this.generateCode(width, height);
      }
    });
  }

  // 카드 라인에 카드 생성 및 추가
  populateCardLine() {
    this.cardLine.innerHTML = "";
    const cardsCount = 30; // 총 카드 개수
    for (let i = 0; i < cardsCount; i++) {
      const cardWrapper = this.createCardWrapper(i);
      this.cardLine.appendChild(cardWrapper);
    }
  }

  // 주기적인 업데이트 시작
  startPeriodicUpdates() {
    // ASCII 코드를 200ms마다 업데이트
    setInterval(() => {
      this.updateAsciiContent();
    }, 200);

    // 클리핑을 매 프레임마다 업데이트
    const updateClipping = () => {
      this.updateCardClipping();
      requestAnimationFrame(updateClipping);
    };
    updateClipping();
  }
}

// 전역 카드 스트림 인스턴스
let cardStream;

// 버튼 클릭용 전역 함수들
function toggleAnimation() {
  if (cardStream) {
    cardStream.toggleAnimation();
  }
}

function resetPosition() {
  if (cardStream) {
    cardStream.resetPosition();
  }
}

function changeDirection() {
  if (cardStream) {
    cardStream.changeDirection();
  }
}

// Three.js를 사용한 3D 파티클 시스템
class ParticleSystem {
  constructor() {
    this.scene = null; // Three.js 씬
    this.camera = null; // Three.js 카메라
    this.renderer = null; // Three.js 렌더러
    this.particles = null; // 파티클 메시
    this.particleCount = 500; // 파티클 개수
    this.canvas = document.getElementById("particleCanvas");

    this.init();
  }

  // Three.js 초기화
  init() {
    this.scene = new THREE.Scene();

    // 직교 카메라 설정 (2D 효과용)
    this.camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      125,
      -125,
      1,
      1000
    );
    this.camera.position.z = 100;

    // WebGL 렌더러 설정
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true, // 투명 배경
      antialias: true, // 안티앨리어싱
    });
    this.renderer.setSize(window.innerWidth, 250);
    this.renderer.setClearColor(0x000000, 0); // 투명

    this.createParticles();
    this.animate();

    window.addEventListener("resize", () => this.onWindowResize());
  }

  // 파티클 생성 및 설정
  createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3); // x, y, z
    const colors = new Float32Array(this.particleCount * 3); // r, g, b
    const sizes = new Float32Array(this.particleCount); // 크기
    const velocities = new Float32Array(this.particleCount); // 속도

    // 파티클 텍스처 생성 (발광 효과)
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    const half = canvas.width / 2;
    const hue = 217; // 파란색 계열

    // 원형 그라디언트로 발광 효과
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0.025, "#fff");
    gradient.addColorStop(0.1, `hsl(${hue}, 61%, 33%)`);
    gradient.addColorStop(0.25, `hsl(${hue}, 64%, 6%)`);
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);

    // 각 파티클의 속성 설정
    for (let i = 0; i < this.particleCount; i++) {
      // 랜덤 위치
      positions[i * 3] = (Math.random() - 0.5) * window.innerWidth * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 250;
      positions[i * 3 + 2] = 0;

      // 흰색
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;

      // 랜덤 크기
      const orbitRadius = Math.random() * 200 + 100;
      sizes[i] = (Math.random() * (orbitRadius - 60) + 60) / 8;

      // 랜덤 속도
      velocities[i] = Math.random() * 60 + 30;
    }

    // 버퍼 속성 설정
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    this.velocities = velocities;

    const alphas = new Float32Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) {
      alphas[i] = (Math.random() * 8 + 2) / 10;
    }
    geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    this.alphas = alphas;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: texture },
        size: { value: 15.0 },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float size;
        
        void main() {
          vAlpha = alpha;
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        varying float vAlpha;
        varying vec3 vColor;
        
        void main() {
          gl_FragColor = vec4(vColor, vAlpha) * texture2D(pointTexture, gl_PointCoord);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const alphas = this.particles.geometry.attributes.alpha.array;
      const time = Date.now() * 0.001;

      for (let i = 0; i < this.particleCount; i++) {
        positions[i * 3] += this.velocities[i] * 0.016;

        if (positions[i * 3] > window.innerWidth / 2 + 100) {
          positions[i * 3] = -window.innerWidth / 2 - 100;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 250;
        }

        positions[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.5;

        const twinkle = Math.floor(Math.random() * 10);
        if (twinkle === 1 && alphas[i] > 0) {
          alphas[i] -= 0.05;
        } else if (twinkle === 2 && alphas[i] < 1) {
          alphas[i] += 0.05;
        }

        alphas[i] = Math.max(0, Math.min(1, alphas[i]));
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.geometry.attributes.alpha.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.left = -window.innerWidth / 2;
    this.camera.right = window.innerWidth / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, 250);
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
  }
}

let particleSystem;

class ParticleScanner {
  constructor() {
    this.canvas = document.getElementById("scannerCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.animationId = null;

    this.w = window.innerWidth;
    this.h = 300;
    this.particles = [];
    this.count = 0;
    this.maxParticles = 800;
    this.intensity = 0.8;
    this.lightBarX = this.w / 2;
    this.lightBarWidth = 3;
    this.fadeZone = 60;

    this.scanTargetIntensity = 1.8;
    this.scanTargetParticles = 2500;
    this.scanTargetFadeZone = 35;

    this.scanningActive = false;

    this.baseIntensity = this.intensity;
    this.baseMaxParticles = this.maxParticles;
    this.baseFadeZone = this.fadeZone;

    this.currentIntensity = this.intensity;
    this.currentMaxParticles = this.maxParticles;
    this.currentFadeZone = this.fadeZone;
    this.transitionSpeed = 0.05;

    this.setupCanvas();
    this.createGradientCache();
    this.initParticles();
    this.animate();

    window.addEventListener("resize", () => this.onResize());
  }

  setupCanvas() {
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  onResize() {
    this.w = window.innerWidth;
    this.lightBarX = this.w / 2;
    this.setupCanvas();
  }

  createGradientCache() {
    this.gradientCanvas = document.createElement("canvas");
    this.gradientCtx = this.gradientCanvas.getContext("2d");
    this.gradientCanvas.width = 16;
    this.gradientCanvas.height = 16;

    const half = this.gradientCanvas.width / 2;
    const gradient = this.gradientCtx.createRadialGradient(
      half,
      half,
      0,
      half,
      half,
      half
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(196, 181, 253, 0.8)");
    gradient.addColorStop(0.7, "rgba(139, 92, 246, 0.4)");
    gradient.addColorStop(1, "transparent");

    this.gradientCtx.fillStyle = gradient;
    this.gradientCtx.beginPath();
    this.gradientCtx.arc(half, half, half, 0, Math.PI * 2);
    this.gradientCtx.fill();
  }

  // 랜덤 정수 생성
  random(min, max) {
    if (arguments.length < 2) {
      max = min;
      min = 0;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 랜덤 실수 생성
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  // 새로운 파티클 생성 (스캔 강도에 따라 속성 변경)
  createParticle() {
    const intensityRatio = this.intensity / this.baseIntensity;
    const speedMultiplier = 1 + (intensityRatio - 1) * 1.2; // 속도 배수
    const sizeMultiplier = 1 + (intensityRatio - 1) * 0.7; // 크기 배수

    return {
      // 스캐너 위치에서 생성
      x:
        this.lightBarX +
        this.randomFloat(-this.lightBarWidth / 2, this.lightBarWidth / 2),
      y: this.randomFloat(0, this.h),

      // 속도 (오른쪽으로 이동)
      vx: this.randomFloat(0.2, 1.0) * speedMultiplier,
      vy: this.randomFloat(-0.15, 0.15) * speedMultiplier,

      // 시각적 속성
      radius: this.randomFloat(0.4, 1) * sizeMultiplier,
      alpha: this.randomFloat(0.6, 1),
      decay: this.randomFloat(0.005, 0.025) * (2 - intensityRatio * 0.5),
      originalAlpha: 0,
      life: 1.0, // 생명력 (1.0에서 0으로 감소)
      time: 0, // 경과 시간
      startX: 0,

      // 깜빡임 효과
      twinkleSpeed: this.randomFloat(0.02, 0.08) * speedMultiplier,
      twinkleAmount: this.randomFloat(0.1, 0.25),
    };
  }

  // 초기 파티클 생성
  initParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }
  }

  // 파티클 업데이트 (위치, 투명도, 생명력)
  updateParticle(particle) {
    particle.x += particle.vx; // X 위치 이동
    particle.y += particle.vy; // Y 위치 이동
    particle.time++;

    // 알파값에 깜빡임 효과 추가
    particle.alpha =
      particle.originalAlpha * particle.life +
      Math.sin(particle.time * particle.twinkleSpeed) * particle.twinkleAmount;

    particle.life -= particle.decay;

    if (particle.x > this.w + 10 || particle.life <= 0) {
      this.resetParticle(particle);
    }
  }

  resetParticle(particle) {
    particle.x =
      this.lightBarX +
      this.randomFloat(-this.lightBarWidth / 2, this.lightBarWidth / 2);
    particle.y = this.randomFloat(0, this.h);
    particle.vx = this.randomFloat(0.2, 1.0);
    particle.vy = this.randomFloat(-0.15, 0.15);
    particle.alpha = this.randomFloat(0.6, 1);
    particle.originalAlpha = particle.alpha;
    particle.life = 1.0;
    particle.time = 0;
    particle.startX = particle.x;
  }

  drawParticle(particle) {
    if (particle.life <= 0) return;

    let fadeAlpha = 1;

    if (particle.y < this.fadeZone) {
      fadeAlpha = particle.y / this.fadeZone;
    } else if (particle.y > this.h - this.fadeZone) {
      fadeAlpha = (this.h - particle.y) / this.fadeZone;
    }

    fadeAlpha = Math.max(0, Math.min(1, fadeAlpha));

    this.ctx.globalAlpha = particle.alpha * fadeAlpha;
    this.ctx.drawImage(
      this.gradientCanvas,
      particle.x - particle.radius,
      particle.y - particle.radius,
      particle.radius * 2,
      particle.radius * 2
    );
  }

  drawLightBar() {
    const verticalGradient = this.ctx.createLinearGradient(0, 0, 0, this.h);
    verticalGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    verticalGradient.addColorStop(
      this.fadeZone / this.h,
      "rgba(255, 255, 255, 1)"
    );
    verticalGradient.addColorStop(
      1 - this.fadeZone / this.h,
      "rgba(255, 255, 255, 1)"
    );
    verticalGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    this.ctx.globalCompositeOperation = "lighter";

    const targetGlowIntensity = this.scanningActive ? 3.5 : 1;

    if (!this.currentGlowIntensity) this.currentGlowIntensity = 1;

    this.currentGlowIntensity +=
      (targetGlowIntensity - this.currentGlowIntensity) * this.transitionSpeed;

    const glowIntensity = this.currentGlowIntensity;
    const lineWidth = this.lightBarWidth;
    const glow1Alpha = this.scanningActive ? 1.0 : 0.8;
    const glow2Alpha = this.scanningActive ? 0.8 : 0.6;
    const glow3Alpha = this.scanningActive ? 0.6 : 0.4;

    const coreGradient = this.ctx.createLinearGradient(
      this.lightBarX - lineWidth / 2,
      0,
      this.lightBarX + lineWidth / 2,
      0
    );
    coreGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    coreGradient.addColorStop(
      0.3,
      `rgba(255, 255, 255, ${0.9 * glowIntensity})`
    );
    coreGradient.addColorStop(0.5, `rgba(255, 255, 255, ${1 * glowIntensity})`);
    coreGradient.addColorStop(
      0.7,
      `rgba(255, 255, 255, ${0.9 * glowIntensity})`
    );
    coreGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = coreGradient;

    const radius = 15;
    this.ctx.beginPath();
    this.ctx.roundRect(
      this.lightBarX - lineWidth / 2,
      0,
      lineWidth,
      this.h,
      radius
    );
    this.ctx.fill();

    const glow1Gradient = this.ctx.createLinearGradient(
      this.lightBarX - lineWidth * 2,
      0,
      this.lightBarX + lineWidth * 2,
      0
    );
    glow1Gradient.addColorStop(0, "rgba(139, 92, 246, 0)");
    glow1Gradient.addColorStop(
      0.5,
      `rgba(196, 181, 253, ${0.8 * glowIntensity})`
    );
    glow1Gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

    this.ctx.globalAlpha = glow1Alpha;
    this.ctx.fillStyle = glow1Gradient;

    const glow1Radius = 25;
    this.ctx.beginPath();
    this.ctx.roundRect(
      this.lightBarX - lineWidth * 2,
      0,
      lineWidth * 4,
      this.h,
      glow1Radius
    );
    this.ctx.fill();

    const glow2Gradient = this.ctx.createLinearGradient(
      this.lightBarX - lineWidth * 4,
      0,
      this.lightBarX + lineWidth * 4,
      0
    );
    glow2Gradient.addColorStop(0, "rgba(139, 92, 246, 0)");
    glow2Gradient.addColorStop(
      0.5,
      `rgba(139, 92, 246, ${0.4 * glowIntensity})`
    );
    glow2Gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

    this.ctx.globalAlpha = glow2Alpha;
    this.ctx.fillStyle = glow2Gradient;

    const glow2Radius = 35;
    this.ctx.beginPath();
    this.ctx.roundRect(
      this.lightBarX - lineWidth * 4,
      0,
      lineWidth * 8,
      this.h,
      glow2Radius
    );
    this.ctx.fill();

    if (this.scanningActive) {
      const glow3Gradient = this.ctx.createLinearGradient(
        this.lightBarX - lineWidth * 8,
        0,
        this.lightBarX + lineWidth * 8,
        0
      );
      glow3Gradient.addColorStop(0, "rgba(139, 92, 246, 0)");
      glow3Gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.2)");
      glow3Gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

      this.ctx.globalAlpha = glow3Alpha;
      this.ctx.fillStyle = glow3Gradient;

      const glow3Radius = 45;
      this.ctx.beginPath();
      this.ctx.roundRect(
        this.lightBarX - lineWidth * 8,
        0,
        lineWidth * 16,
        this.h,
        glow3Radius
      );
      this.ctx.fill();
    }

    this.ctx.globalCompositeOperation = "destination-in";
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = verticalGradient;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  render() {
    const targetIntensity = this.scanningActive
      ? this.scanTargetIntensity
      : this.baseIntensity;
    const targetMaxParticles = this.scanningActive
      ? this.scanTargetParticles
      : this.baseMaxParticles;
    const targetFadeZone = this.scanningActive
      ? this.scanTargetFadeZone
      : this.baseFadeZone;

    this.currentIntensity +=
      (targetIntensity - this.currentIntensity) * this.transitionSpeed;
    this.currentMaxParticles +=
      (targetMaxParticles - this.currentMaxParticles) * this.transitionSpeed;
    this.currentFadeZone +=
      (targetFadeZone - this.currentFadeZone) * this.transitionSpeed;

    this.intensity = this.currentIntensity;
    this.maxParticles = Math.floor(this.currentMaxParticles);
    this.fadeZone = this.currentFadeZone;

    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, this.w, this.h);

    this.drawLightBar();

    this.ctx.globalCompositeOperation = "lighter";
    for (let i = 1; i <= this.count; i++) {
      if (this.particles[i]) {
        this.updateParticle(this.particles[i]);
        this.drawParticle(this.particles[i]);
      }
    }

    const currentIntensity = this.intensity;
    const currentMaxParticles = this.maxParticles;

    if (Math.random() < currentIntensity && this.count < currentMaxParticles) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }

    const intensityRatio = this.intensity / this.baseIntensity;

    if (intensityRatio > 1.1 && Math.random() < (intensityRatio - 1.0) * 1.2) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }

    if (intensityRatio > 1.3 && Math.random() < (intensityRatio - 1.3) * 1.4) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }

    if (intensityRatio > 1.5 && Math.random() < (intensityRatio - 1.5) * 1.8) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }

    if (intensityRatio > 2.0 && Math.random() < (intensityRatio - 2.0) * 2.0) {
      const particle = this.createParticle();
      particle.originalAlpha = particle.alpha;
      particle.startX = particle.x;
      this.count++;
      this.particles[this.count] = particle;
    }

    if (this.count > currentMaxParticles + 200) {
      const excessCount = Math.min(15, this.count - currentMaxParticles);
      for (let i = 0; i < excessCount; i++) {
        delete this.particles[this.count - i];
      }
      this.count -= excessCount;
    }
  }

  animate() {
    this.render();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  startScanning() {
    this.scanningActive = true;
    console.log("Scanning started - intense particle mode activated");
  }

  // 스캔 시작 (파티클 강도 증가)
  startScanning() {
    this.scanningActive = true;
    console.log("Scanning started - intense particle mode activated");
  }

  // 스캔 중지 (일반 파티클 모드)
  stopScanning() {
    this.scanningActive = false;
    console.log("Scanning stopped - normal particle mode");
  }

  // 스캔 상태 설정 (카드가 스캐너를 통과할 때 호출)
  setScanningActive(active) {
    this.scanningActive = active;
    console.log("Scanning mode:", active ? "active" : "inactive");
  }

  // 현재 파티클 시스템 상태 반환
  getStats() {
    return {
      intensity: this.intensity,
      maxParticles: this.maxParticles,
      currentParticles: this.count,
      lightBarWidth: this.lightBarWidth,
      fadeZone: this.fadeZone,
      scanningActive: this.scanningActive,
      canvasWidth: this.w,
      canvasHeight: this.h,
    };
  }

  // 파티클 시스템 종료
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.particles = [];
    this.count = 0;
  }
}

// 전역 파티클 스캐너 인스턴스
let particleScanner;

// DOM 로드 완료 시 모든 시스템 초기화
document.addEventListener("DOMContentLoaded", () => {
  cardStream = new CardStreamController(); // 카드 스트림 시스템
  particleSystem = new ParticleSystem(); // 3D 파티클 시스템 (배경)
  particleScanner = new ParticleScanner(); // 2D 파티클 스캐너

  // 스캔 상태를 파티클 스캐너에 전달하는 전역 함수
  window.setScannerScanning = (active) => {
    if (particleScanner) {
      particleScanner.setScanningActive(active);
    }
  };

  // 스캐너 상태 정보를 가져오는 전역 함수 (디버깅용)
  window.getScannerStats = () => {
    if (particleScanner) {
      return particleScanner.getStats();
    }
    return null;
  };
});
