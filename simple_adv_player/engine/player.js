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
  const eventRegistry = window.SimpleAdvEventRegistry;
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
      fallback.textContent = id.replaceAll("_", " ");
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

  function showChoice(command) {
    ui.choices.replaceChildren();
    command.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.text;
      button.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        [...ui.choices.children].forEach((item) => { item.disabled = true; });
        jump(option.scene);
        busy = false;
        execute();
      }, { once: true });
      ui.choices.append(button);
    });
    ui.choices.classList.remove("hidden");
    busy = false;
    save();
    ui.choices.querySelector("button").focus();
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
          case "choice": showChoice(command); return;
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
    const eventDefinition = eventRegistry.get(command.event);
    const result = await eventDefinition.run(command.args, { root: ui.eventLayer, assets: game.assets, settings });
    const expected = eventDefinition.resultTypes;
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
      game = window.SimpleAdvValidator.validate(await response.json(), eventRegistry);
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
