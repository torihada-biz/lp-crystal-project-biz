const stageWrap = document.querySelector(".stage-wrap");
const stage = document.querySelector(".stage");
const cine = document.querySelector(".cine");
const cinePhones = document.querySelectorAll(".cine__phone");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
// p が [a,b] を進む割合（0〜1）
const ramp = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

/* .stage（TryVII以降）を画面幅に合わせて縮小 */
const STAGE_W = 390;
const PC_W = 440; // PC(≥960)での表示幅（390デザインを少し拡大して中央表示）

function fitStage() {
  if (!stage || !stageWrap) return;
  const vw = window.innerWidth;
  // <960: 幅いっぱいにスケール（黒帯なし） / ≥960: PC_Wで固定し中央寄せ
  const scale = vw >= 960 ? PC_W / STAGE_W : vw / STAGE_W;
  const offsetLeft = vw >= 960 ? Math.max(0, (vw - PC_W) / 2) : 0;
  stage.style.transform = `scale(${scale})`;
  stage.style.marginLeft = `${offsetLeft}px`;
  stageWrap.style.height = `${stage.offsetHeight * scale}px`;
}

/* シネマ枠の390x714フォンを、コンテンツ(.stage)と同じ幅基準でスケール（幅を揃える） */
function fitCine() {
  const vw = window.innerWidth || 390;
  const vh = window.innerHeight || 714;
  // 前景(ロゴ/人/コピー/story)はビューポートに収める(contain)＝ヒーローもstoryも見切れない。
  // 背景(.cine-fullbg)は別途全幅。PC(≥960)は PC_W 固定。
  const scale = vw >= 960 ? PC_W / 390 : Math.min(vw / 390, vh / 714);
  cinePhones.forEach((p) => {
    p.style.transform = `scale(${scale})`;
  });
}

/* dim（暗幕）のopacityをフェーズごとに算出：暗→暗転→明転→明保持→暗転→story */
function dimOpacity(p) {
  if (p < 0.26) return 0.45; // splash〜暗めを保持
  if (p < 0.46) return lerp(0.45, 0.0, ramp(p, 0.26, 0.46)); // 明転
  if (p < 0.80) return 0.0; // 明るく保持（ヒーロー＋リードを長めに見せる）
  if (p < 0.90) return lerp(0.0, 0.8, ramp(p, 0.80, 0.90)); // 暗転
  return 0.8; // storyの背景として暗いまま
}

const setLayer = (el, opacity, ty) => {
  if (!el) return;
  el.style.opacity = opacity.toFixed(3);
  if (ty !== undefined) el.style.transform = `translateY(${ty.toFixed(1)}px)`;
};
const setLayerCx = (el, opacity, ty) => {
  // center-x（translateX(-50%)を保持したまま）の要素用
  if (!el) return;
  el.style.opacity = opacity.toFixed(3);
  el.style.transform = `translateX(-50%) translateY(${(ty || 0).toFixed(1)}px)`;
};

const L = {
  copy: document.querySelector(".cine-copy"),
  crystal: document.querySelector(".cine-crystal"),
  core: document.querySelector(".cine-core"),
  idol: document.querySelector(".cine-idol"),
  logo: document.querySelector(".cine-logo"),
  ppp: document.querySelector(".cine-ppp"),
  lead: document.querySelector(".cine-lead"),
  scroll: document.querySelector(".cine-scroll"),
  dim: document.querySelector(".cine-dim"),
  storyHead: document.querySelector(".cine-story-head"),
  storyContent: document.querySelector(".cine-story-content"),
};

/* シネマのスクロール進行度(0〜1)で各レイヤーをスクラブ */
function renderCine(p) {
  setLayer(L.copy, 1 - ramp(p, 0.1, 0.2));
  // SCROLLインジケーターはopacityのみ操作（transformはCSSのバウンスを維持）
  if (L.scroll) L.scroll.style.opacity = (1 - ramp(p, 0.04, 0.14)).toFixed(3);
  setLayer(L.crystal, ramp(p, 0.28, 0.46));
  setLayerCx(L.core, ramp(p, 0.28, 0.46));
  const idolP = ramp(p, 0.28, 0.58);
  setLayerCx(L.idol, idolP, (1 - idolP) * 26);
  const logoP = ramp(p, 0.28, 0.68);
  setLayer(L.logo, logoP, (1 - logoP) * 22);
  setLayer(L.ppp, ramp(p, 0.28, 0.7));
  const leadP = ramp(p, 0.42, 0.52);
  setLayer(L.lead, leadP, (1 - leadP) * 18);
  if (L.dim) L.dim.style.opacity = dimOpacity(p).toFixed(3);
  const stP = ramp(p, 0.84, 0.93);
  setLayer(L.storyHead, stP, (1 - stP) * 30);
  setLayer(L.storyContent, stP, (1 - stP) * 34);
}

/* .parallax 要素を data-speed に応じて上下移動 */
const layers = [...document.querySelectorAll(".parallax")];
function renderParallax(vh) {
  layers.forEach((layer) => {
    const parent = layer.closest(".phone") || layer.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const speed = Number(layer.dataset.speed || 0);
    const centerDelta = vh * 0.5 - (rect.top + rect.height * 0.5);
    const offset = clamp((centerDelta / vh) * speed * 900, -400, 400);
    const isCentered = layer.classList.contains("center-x");
    layer.style.transform = isCentered
      ? `translateX(-50%) translate3d(0, ${offset}px, 0)`
      : `translate3d(0, ${offset}px, 0)`;
  });
}

let ticking = false;
function update() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 1;

  if (cine) {
    const track = cine.offsetHeight - vh;
    const p = track > 0 ? clamp((scrollY - cine.offsetTop) / track, 0, 1) : 0;
    renderCine(p);
  }
  if (!prefersReducedMotion) renderParallax(vh);

  ticking = false;
}
function requestUpdate() {
  if (!ticking) {
    window.requestAnimationFrame(update);
    ticking = true;
  }
}

/* reveal（.page側のフェードイン） */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((t) => revealObserver.observe(t));

window.addEventListener("load", () => {
  fitStage();
  fitCine();
  update();
});
window.addEventListener("resize", () => {
  fitStage();
  fitCine();
  requestUpdate();
});
window.addEventListener("scroll", requestUpdate, { passive: true });
fitCine();
update();

/* ===== CTA / 目次 の挙動（参照プロジェクト準拠） =====
   ENTRY_URL を設定すると CTA は外部リンク（LINE等）へ遷移。空なら #entry へスムーズスクロール。
   目次（.side-nav a）は各セクションへスムーズスクロール。 */
const ENTRY_URL = ""; // CTAのhrefにLINE URLを直接設定済み（target=_blankで新規タブ）。ここを使う場合は同一タブ遷移
function smoothToHash(href) {
  if (!href || href.charAt(0) !== "#") return false;
  const target = document.querySelector(href);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}
document.querySelectorAll(".js-entry-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    if (ENTRY_URL) {
      e.preventDefault();
      window.location.href = ENTRY_URL;
      return;
    }
    if (smoothToHash(link.getAttribute("href"))) e.preventDefault();
  });
});
document.querySelectorAll(".side-nav a").forEach((link) => {
  link.addEventListener("click", (e) => {
    if (smoothToHash(link.getAttribute("href"))) e.preventDefault();
  });
});
