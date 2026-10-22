const board = document.querySelector("#board");
const wordList = document.querySelector("#word-list");
const cardsGrid = document.querySelector("#cards-grid");
const connections = document.querySelector("#connections");
const resultPanel = document.querySelector("#result-panel");
const toast = document.querySelector("#toast");
const chips = [...document.querySelectorAll(".word-chip")];
const cards = [...document.querySelectorAll(".image-card")];
const drops = [...document.querySelectorAll(".drop-slot")];

let correctMatches = 0;
let mistakes = 0;
let toastTimer;
let dragState = null;
let selectedChip = null;
const matchedPairs = new Map();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function updateProgress() {
  document.querySelector("#progress-label b").textContent = correctMatches;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", correctMatches);
  document.querySelector("#progress-fill").style.width = `${correctMatches * 25}%`;
  document.querySelector("#mistake-count b").textContent = mistakes;
}

function getCardAtPoint(x, y) {
  const target = document.elementFromPoint(x, y);
  const card = target?.closest(".image-card");
  return card && !card.classList.contains("is-matched") ? card : null;
}

function setActiveCard(card) {
  cards.forEach((item) => item.classList.toggle("is-over", item === card));
  drops.forEach((slot) => slot.classList.toggle("is-over", card?.contains(slot) ?? false));
}

function makeConnection(chip, drop) {
  const boardRect = board.getBoundingClientRect();
  const chipRect = chip.getBoundingClientRect();
  const dropRect = drop.getBoundingClientRect();
  const mobileLayout = window.matchMedia("(max-width: 760px)").matches;
  const startX = mobileLayout
    ? chipRect.left + chipRect.width / 2 - boardRect.left
    : chipRect.right - boardRect.left;
  const startY = mobileLayout
    ? chipRect.bottom - boardRect.top
    : chipRect.top + chipRect.height / 2 - boardRect.top;
  const endX = mobileLayout
    ? dropRect.left + dropRect.width / 2 - boardRect.left
    : dropRect.left - boardRect.left;
  const endY = mobileLayout
    ? dropRect.top - boardRect.top
    : dropRect.top + dropRect.height / 2 - boardRect.top;
  const distance = Math.max(35, Math.abs(mobileLayout ? endY - startY : endX - startX) * 0.45);
  const control1X = startX + (mobileLayout ? 0 : distance);
  const control1Y = startY + (mobileLayout ? distance : 0);
  const control2X = endX - (mobileLayout ? 0 : distance);
  const control2Y = endY - (mobileLayout ? distance : 0);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "connection-path");
  path.setAttribute("d", `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`);
  connections.append(path);

  for (const [x, y] of [[startX, startY], [endX, endY]]) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "connection-dot");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", "5");
    connections.append(dot);
  }
}

function redrawConnections() {
  const rect = board.getBoundingClientRect();
  connections.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  connections.replaceChildren();
  matchedPairs.forEach(({ chip, drop }) => makeConnection(chip, drop));
}

function matchCard(chip, card) {
  if (!card || card.classList.contains("is-matched")) return false;

  if (chip.dataset.word !== card.dataset.answer) {
    mistakes += 1;
    updateProgress();
    card.classList.remove("is-wrong");
    requestAnimationFrame(() => card.classList.add("is-wrong"));
    showToast("再看仔細一點，試試其他詞卡！");
    window.setTimeout(() => card.classList.remove("is-wrong"), 380);
    return false;
  }

  const drop = card.querySelector(".drop-slot");
  chip.classList.add("is-matched");
  chip.setAttribute("aria-pressed", "true");
  chip.disabled = true;
  card.classList.add("is-matched");
  card.querySelector(".card-state").textContent = "配對成功";
  drop.classList.add("is-filled");
  drop.textContent = chip.dataset.word;
  drop.setAttribute("aria-label", `${chip.dataset.word}，配對成功`);
  drop.setAttribute("aria-disabled", "true");
  matchedPairs.set(chip.dataset.word, { chip, drop });
  selectedChip = null;
  correctMatches += 1;
  updateProgress();
  requestAnimationFrame(redrawConnections);

  if (correctMatches === chips.length) finishQuiz();
  else showToast("配對正確！");
  return true;
}

function finishQuiz() {
  board.classList.add("is-complete");
  connections.replaceChildren();
  const totalAnswers = correctMatches + mistakes;
  const accuracy = Math.round((correctMatches / totalAnswers) * 100);
  document.querySelector("#result-score").textContent = `${correctMatches} / ${chips.length}`;
  document.querySelector("#result-accuracy").textContent = `${accuracy}%`;
  document.querySelector("#result-copy").textContent = mistakes === 0
    ? "一次就全部答對，觀察力真好。"
    : `完成全部配對，共嘗試 ${totalAnswers} 次。`;
  resultPanel.hidden = false;
  document.querySelector("#play-again").focus();
}

function startDrag(event, chip) {
  if (chip.disabled || event.button !== 0) return;
  event.preventDefault();
  selectedChip = chip;
  const rect = chip.getBoundingClientRect();
  const ghost = chip.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.classList.add("is-dragging");
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.margin = "0";
  ghost.style.pointerEvents = "none";
  document.body.append(ghost);
  chip.classList.add("is-hidden");

  dragState = {
    chip,
    ghost,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  moveDrag(event);
}

function moveDrag(event) {
  if (!dragState) return;
  const { ghost, offsetX, offsetY } = dragState;
  ghost.style.left = `${event.clientX - offsetX}px`;
  ghost.style.top = `${event.clientY - offsetY}px`;
  setActiveCard(getCardAtPoint(event.clientX, event.clientY));
}

function endDrag(event) {
  if (!dragState) return;
  const { chip, ghost } = dragState;
  const card = getCardAtPoint(event.clientX, event.clientY);
  ghost.remove();
  chip.classList.remove("is-hidden");
  setActiveCard(null);
  dragState = null;
  if (card) matchCard(chip, card);
}

chips.forEach((chip) => {
  chip.addEventListener("pointerdown", (event) => startDrag(event, chip));
  chip.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !chip.disabled) {
      event.preventDefault();
      selectedChip = chip;
      showToast(`已選取「${chip.dataset.word}」，請移至影像配對區並按 Enter。`);
    }
  });
});

drops.forEach((drop) => {
  drop.tabIndex = 0;
  drop.setAttribute("role", "button");
  drop.setAttribute("aria-label", "影像配對位置");
  drop.addEventListener("keydown", (event) => {
    if (!selectedChip || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    matchCard(selectedChip, drop.closest(".image-card"));
  });
});

document.addEventListener("pointermove", moveDrag);
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", redrawConnections);
window.addEventListener("load", redrawConnections);
document.querySelectorAll(".media-frame img").forEach((image) => {
  image.addEventListener("load", redrawConnections);
});

function resetQuiz() {
  correctMatches = 0;
  mistakes = 0;
  selectedChip = null;
  matchedPairs.clear();
  board.classList.remove("is-complete");
  resultPanel.hidden = true;
  connections.replaceChildren();
  chips.forEach((chip) => {
    chip.disabled = false;
    chip.classList.remove("is-matched", "is-hidden");
    chip.setAttribute("aria-pressed", "false");
  });
  cards.forEach((card) => {
    card.classList.remove("is-matched", "is-wrong", "is-over");
    card.querySelector(".card-state").textContent = "待配對";
  });
  drops.forEach((drop) => {
    drop.classList.remove("is-filled", "is-over");
    drop.innerHTML = '<span class="drop-placeholder">將詞卡放在這裡</span>';
    drop.setAttribute("aria-label", "影像配對位置");
    drop.removeAttribute("aria-disabled");
  });
  toast.classList.remove("is-visible");
  updateProgress();
  chips[0].focus();
}

document.querySelector("#reset-button").addEventListener("click", resetQuiz);
document.querySelector("#play-again").addEventListener("click", resetQuiz);
updateProgress();

const resizeObserver = new ResizeObserver(redrawConnections);
resizeObserver.observe(board);