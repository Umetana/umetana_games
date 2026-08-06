(function () {
  "use strict";

  const el = (id) => document.getElementById(id);
  const ui = {
    app: el("app"), background: el("background"), stage: el("stage"), messageBox: el("message-box"),
    speaker: el("speaker"), message: el("message"), choices: el("choices"), eventLayer: el("event-layer"),
    endLayer: el("end-layer"), endMessage: el("end-message"), errorLayer: el("error-layer"),
    errorMessage: el("error-message"), settings: el("settings-dialog"), notice: el("notice")
  };
  const slots = { left: el("slot-left"), center: el("slot-center"), right: el("slot-right") };
  const idPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
  const commandTypes = new Set(["background", "character", "characterHide", "message", "choice", "set", "add", "branch", "jump", "bgm", "bgmStop", "se", "event", "end"]);
  let game;
  let state;
  let busy = false;
  let bgm = null;
  let settings = { bgm: true, se: true };
  let saveKey = "";
  let settingsKey = "simple-adv:settings";

  function fail(code, detail) {
    busy = true;
    ui.messageBox.classList.add("hidden");
    ui.eventLayer.classList.add("hidden");
    ui.errorMessage.textContent = `${detail}\n（${code}）`;
    ui.errorMessage.style.whiteSpace = "pre-line";
    ui.errorLayer.classList.remove("hidden");
    ui.app.setAttribute("aria-busy", "false");
  }

  function warn(message) {
    ui.notice.textContent = message;
    ui.notice.classList.remove("hidden");
    window.setTimeout(() => ui.notice.classList.add("hidden"), 5000);
  }

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function assert(condition, code) { if (!condition) throw new Error(code); }
  function validPath(path) { return typeof path === "string" && path && !path.startsWith("/") && !path.includes("..") && !path.includes("\\") && !/^[a-z]+:/i.test(path); }
  function assetExists(id) { return Boolean(game.assets.characters[id] || game.assets.enemies[id]); }

  function validateEvent(command) {
    assert(command.event === "multiplicationQuiz" && window.SimpleAdvEvents[command.event], "UNKNOWN_EVENT");
    const a = command.args;
    assert(isObject(a) && Array.isArray(a.rows) && a.rows.length > 0 && a.rows.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) && new Set(a.rows).size === a.rows.length, "INVALID_EVENT_ROWS");
    assert(Number.isInteger(a.questionCount) && a.questionCount >= 1 && a.questionCount <= a.rows.length * 9, "INVALID_EVENT_COUNT");
    const required = a.requiredCorrect === undefined ? a.questionCount : a.requiredCorrect;
    assert(Number.isInteger(required) && required >= 0 && required <= a.questionCount, "INVALID_EVENT_REQUIRED");
    assert(isObject(command.result) && Object.keys(command.result).sort().join() === "cleared,correct,wrong", "INVALID_EVENT_RESULT");
    Object.values(command.result).forEach((name) => assert(Object.hasOwn(game.variables, name), "UNKNOWN_RESULT_VARIABLE"));
    if (a.presentation) {
      assert(isObject(a.presentation), "INVALID_PRESENTATION");
      if (a.presentation.allyCutin !== undefined) assert(Boolean(game.assets.characters[a.presentation.allyCutin]), "UNKNOWN_ALLY_ASSET");
      if (a.presentation.enemy !== undefined) assert(Boolean(game.assets.enemies[a.presentation.enemy]), "UNKNOWN_ENEMY_ASSET");
    }
  }

  function validateGame(data) {
    game = data;
    assert(isObject(game) && game.formatVersion === 1, "FORMAT_VERSION");
    assert(isObject(game.game) && idPattern.test(game.game.id) && Number.isInteger(game.game.revision) && game.game.revision >= 1 && typeof game.game.title === "string" && game.game.title, "INVALID_METADATA");
    assert(isObject(game.assets) && ["backgrounds", "characters", "enemies", "bgm", "se"].every((key) => isObject(game.assets[key])), "INVALID_ASSETS");
    Object.values(game.assets).forEach((group) => Object.entries(group).forEach(([id, path]) => assert(idPattern.test(id) && validPath(path), "INVALID_ASSET_PATH")));
    assert(isObject(game.variables) && Object.values(game.variables).every((v) => typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))), "INVALID_VARIABLES");
    assert(isObject(game.scenes) && game.scenes[game.game.startScene], "INVALID_START_SCENE");
    Object.entries(game.scenes).forEach(([sceneId, commands]) => {
      assert(idPattern.test(sceneId) && Array.isArray(commands) && commands.length > 0, "INVALID_SCENE");
      commands.forEach((command) => {
        assert(isObject(command) && commandTypes.has(command.type), `UNKNOWN_COMMAND:${sceneId}`);
        if (command.type === "background") assert(Boolean(game.assets.backgrounds[command.asset]), "UNKNOWN_BACKGROUND");
        if (command.type === "character") assert(slots[command.slot] && assetExists(command.asset) && command.asset !== "elma_bow", "INVALID_CHARACTER");
        if (command.type === "characterHide") assert(Boolean(slots[command.slot]), "INVALID_SLOT");
        if (command.type === "message") assert(typeof command.text === "string" && command.text, "INVALID_MESSAGE");
        if (["jump"].includes(command.type)) assert(Boolean(game.scenes[command.scene]), "UNKNOWN_SCENE");
        if (command.type === "branch") {
          assert(game.scenes[command.then] && game.scenes[command.else] && isObject(command.condition), "INVALID_BRANCH");
          assert(Object.hasOwn(game.variables, command.condition.variable) && ["==", "!=", ">", ">=", "<", "<="].includes(command.condition.operator), "INVALID_CONDITION");
        }
        if (command.type === "event") validateEvent(command);
      });
      assert(["jump", "branch", "choice", "end"].includes(commands[commands.length - 1].type), `SCENE_HAS_NO_EXIT:${sceneId}`);
    });
  }

  function initialState() {
    return { scene: game.game.startScene, index: 0, variables: structuredClone(game.variables), display: { background: null, slots: { left: null, center: null, right: null }, bgm: null }, ended: false };
  }

  function loadJson(key) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } }
  function save() {
    try { localStorage.setItem(saveKey, JSON.stringify({ gameId: game.game.id, revision: game.game.revision, ...state })); }
    catch { warn("このたびは じどうセーブが できません。ゲームは そのまま あそべます。"); }
  }
  function loadSave() {
    const saved = loadJson(saveKey);
    if (!saved) return initialState();
    const valid = saved.gameId === game.game.id && saved.revision === game.game.revision && game.scenes[saved.scene] && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < game.scenes[saved.scene].length && isObject(saved.variables) && isObject(saved.display);
    if (!valid || Object.keys(game.variables).some((key) => typeof saved.variables[key] !== typeof game.variables[key])) {
      warn("まえの セーブは つかえないため、はじめから スタートします。");
      return initialState();
    }
    return saved;
  }

  function resolveAsset(id) { return game.assets.characters[id] || game.assets.enemies[id]; }
  function setBackground(id) {
    state.display.background = id;
    ui.background.classList.remove("missing");
    ui.background.style.backgroundImage = `url("${game.assets.backgrounds[id]}")`;
    const probe = new Image();
    probe.addEventListener("error", () => { ui.background.style.backgroundImage = "none"; ui.background.classList.add("missing"); warn("はいけいを よみこめませんでした。かりの画面で つづけます。"); }, { once: true });
    probe.src = game.assets.backgrounds[id];
  }

  function setCharacter(slot, id) {
    state.display.slots[slot] = id;
    const target = slots[slot];
    target.replaceChildren();
    target.classList.toggle("enemy", Boolean(game.assets.enemies[id]));
    const img = document.createElement("img");
    img.src = resolveAsset(id);
    img.alt = "";
    img.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.className = "fallback";
      fallback.textContent = id === "slime_two" ? "にのだん\nスライム" : id.startsWith("elma") ? "エルマ" : "ユウ";
      fallback.style.whiteSpace = "pre-line";
      target.replaceChildren(fallback);
      warn("たちえを よみこめませんでした。かりの表示で つづけます。");
    }, { once: true });
    target.append(img);
  }

  function hideCharacter(slot) { state.display.slots[slot] = null; slots[slot].replaceChildren(); slots[slot].classList.remove("enemy"); }
  function restoreDisplay() {
    if (state.display.background) setBackground(state.display.background);
    Object.entries(state.display.slots).forEach(([slot, id]) => id ? setCharacter(slot, id) : hideCharacter(slot));
  }

  function hideWaitingUi() { ui.messageBox.classList.add("hidden"); ui.choices.classList.add("hidden"); ui.choices.replaceChildren(); }
  function showMessage(command) {
    ui.speaker.textContent = command.speaker || "";
    ui.message.textContent = command.text;
    ui.messageBox.classList.remove("hidden");
    busy = false;
    save();
    ui.messageBox.focus({ preventScroll: true });
  }

  function compare(condition) {
    const left = state.variables[condition.variable];
    const right = condition.value;
    if (typeof left !== typeof right) throw new Error("CONDITION_TYPE_MISMATCH");
    return ({ "==": () => left === right, "!=": () => left !== right, ">": () => left > right, ">=": () => left >= right, "<": () => left < right, "<=": () => left <= right })[condition.operator]();
  }

  function jump(scene) { state.scene = scene; state.index = 0; hideWaitingUi(); save(); }
  async function execute() {
    if (busy || state.ended) return;
    busy = true;
    hideWaitingUi();
    let automatic = 0;
    try {
      while (automatic < 500) {
        automatic += 1;
        const commands = game.scenes[state.scene];
        const command = commands && commands[state.index];
        if (!command) throw new Error(`INVALID_POSITION:${state.scene}:${state.index}`);
        switch (command.type) {
          case "background": setBackground(command.asset); state.index += 1; save(); break;
          case "character": setCharacter(command.slot, command.asset); state.index += 1; save(); break;
          case "characterHide": hideCharacter(command.slot); state.index += 1; save(); break;
          case "message": showMessage(command); return;
          case "jump": jump(command.scene); break;
          case "branch": jump(compare(command.condition) ? command.then : command.else); break;
          case "set": state.variables[command.variable] = command.value; state.index += 1; save(); break;
          case "add": state.variables[command.variable] += command.value ?? state.variables[command.fromVariable]; state.index += 1; save(); break;
          case "bgm": playBgm(command.asset); state.index += 1; save(); break;
          case "bgmStop": stopBgm(); state.index += 1; save(); break;
          case "se": playSe(command.asset); state.index += 1; save(); break;
          case "event": await runEvent(command); break;
          case "end": showEnd(command.message || "おしまい"); return;
          default: throw new Error(`UNSUPPORTED_COMMAND:${command.type}`);
        }
      }
      throw new Error("AUTOMATIC_COMMAND_LIMIT");
    } catch (error) { fail("PLAYER_RUNTIME_ERROR", error.message); }
  }

  async function runEvent(command) {
    save();
    ui.eventLayer.classList.remove("hidden");
    const result = await window.SimpleAdvEvents[command.event](command.args, { root: ui.eventLayer, assets: game.assets, settings });
    const expected = { correct: "number", wrong: "number", cleared: "boolean" };
    assert(Object.entries(expected).every(([key, type]) => typeof result[key] === type), "INVALID_EVENT_RETURN");
    Object.entries(command.result).forEach(([key, variable]) => { assert(typeof state.variables[variable] === typeof result[key], "EVENT_RESULT_TYPE"); });
    Object.entries(command.result).forEach(([key, variable]) => { state.variables[variable] = result[key]; });
    state.index += 1;
    save();
    ui.eventLayer.replaceChildren();
    ui.eventLayer.classList.add("hidden");
  }

  function showEnd(message) { state.ended = true; save(); ui.endMessage.textContent = message; ui.endLayer.classList.remove("hidden"); busy = false; }
  function playBgm(id) {
    if (!game.assets.bgm[id]) return;
    if (state.display.bgm === id && bgm) return;
    stopBgm(); state.display.bgm = id; bgm = new Audio(game.assets.bgm[id]); bgm.loop = true;
    if (settings.bgm) bgm.play().catch(() => {});
  }
  function stopBgm() { if (bgm) { bgm.pause(); bgm = null; } state.display.bgm = null; }
  function playSe(id) { if (settings.se && game.assets.se[id]) new Audio(game.assets.se[id]).play().catch(() => {}); }

  function advanceMessage() {
    if (busy || ui.messageBox.classList.contains("hidden")) return;
    busy = true;
    ui.messageBox.classList.add("hidden");
    state.index += 1;
    save();
    busy = false;
    execute();
  }

  function restart() {
    if (!window.confirm("セーブを けして、はじめから あそびますか？")) return;
    try { localStorage.removeItem(saveKey); } catch { /* Current session can still restart. */ }
    stopBgm();
    state = initialState();
    ui.settings.close(); ui.endLayer.classList.add("hidden"); ui.errorLayer.classList.add("hidden");
    restoreDisplay(); busy = false; execute();
  }

  function bindUi() {
    ui.messageBox.addEventListener("click", advanceMessage);
    ui.messageBox.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); advanceMessage(); } });
    el("settings-button").addEventListener("click", (event) => { event.stopPropagation(); ui.settings.showModal(); });
    el("restart-button").addEventListener("click", restart);
    el("end-restart").addEventListener("click", restart);
    el("error-reload").addEventListener("click", () => location.reload());
    el("bgm-toggle").addEventListener("change", (event) => { settings.bgm = event.target.checked; if (!settings.bgm && bgm) bgm.pause(); else if (settings.bgm && bgm) bgm.play().catch(() => {}); storeSettings(); });
    el("se-toggle").addEventListener("change", (event) => { settings.se = event.target.checked; storeSettings(); });
  }

  function storeSettings() { try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { warn("おとの せっていを ほぞんできませんでした。"); } }
  function loadSettings() {
    const saved = loadJson(settingsKey);
    if (saved && typeof saved.bgm === "boolean" && typeof saved.se === "boolean") settings = saved;
    el("bgm-toggle").checked = settings.bgm; el("se-toggle").checked = settings.se;
  }

  async function start() {
    bindUi(); loadSettings();
    try {
      const response = await fetch("game.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      validateGame(await response.json());
      document.title = game.game.title;
      saveKey = `simple-adv:save:${game.game.id}`;
      state = loadSave();
      restoreDisplay();
      ui.app.setAttribute("aria-busy", "false");
      if (state.ended) showEnd(game.scenes[state.scene][state.index].message || "おしまい"); else { busy = false; execute(); }
    } catch (error) { fail("GAME_LOAD_ERROR", `作品データを よみこめませんでした。\n${error.message}`); }
  }

  start();
}());
