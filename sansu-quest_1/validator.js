(function () {
  "use strict";

  const idPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
  const gameIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
  const commandTypes = new Set(["background", "character", "characterHide", "message", "choice", "set", "add", "branch", "jump", "bgm", "bgmStop", "se", "event", "end"]);
  const slots = new Set(["left", "center", "right"]);

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function assert(condition, code) { if (!condition) throw new Error(code); }
  function validPath(path) { return typeof path === "string" && path && !path.startsWith("/") && !path.includes("..") && !path.includes("\\") && !/^[a-z]+:/i.test(path); }

  function validateEvent(command, game, registry) {
    assert(typeof command.event === "string" && registry.has(command.event), `UNKNOWN_EVENT:${command.event}`);
    const definition = registry.get(command.event);
    definition.validate(command.args, game.assets);
    assert(isObject(command.result), "INVALID_EVENT_RESULT");
    const expectedKeys = Object.keys(definition.resultTypes).sort();
    assert(Object.keys(command.result).sort().join() === expectedKeys.join(), "INVALID_EVENT_RESULT_KEYS");
    Object.entries(command.result).forEach(([key, variable]) => {
      assert(Object.hasOwn(game.variables, variable), `UNKNOWN_RESULT_VARIABLE:${variable}`);
      assert(typeof game.variables[variable] === definition.resultTypes[key], `RESULT_VARIABLE_TYPE:${variable}`);
    });
  }

  function validate(data, registry) {
    const game = data;
    assert(isObject(game) && [1, 2].includes(game.formatVersion), "FORMAT_VERSION");
    assert(isObject(game.game) && gameIdPattern.test(game.game.id) && Number.isInteger(game.game.revision) && game.game.revision >= 1 && typeof game.game.title === "string" && game.game.title, "INVALID_METADATA");
    assert(isObject(game.assets) && ["backgrounds", "characters", "enemies", "bgm", "se"].every((key) => isObject(game.assets[key])), "INVALID_ASSETS");
    Object.values(game.assets).forEach((group) => Object.entries(group).forEach(([id, path]) => assert(idPattern.test(id) && validPath(path), `INVALID_ASSET_PATH:${id}`)));
    assert(isObject(game.variables) && Object.values(game.variables).every((value) => typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))), "INVALID_VARIABLES");
    assert(isObject(game.scenes) && game.scenes[game.game.startScene], "INVALID_START_SCENE");
    if (game.formatVersion === 2) {
      assert(isObject(game.game.titleScreen), "MISSING_TITLE_SCREEN");
      const title = game.game.titleScreen;
      assert(typeof title.background === "string" && Boolean(game.assets.backgrounds[title.background]), "INVALID_TITLE_BACKGROUND");
      assert(typeof title.newGameLabel === "string" && title.newGameLabel && typeof title.continueLabel === "string" && title.continueLabel, "INVALID_TITLE_LABELS");
    }

    Object.entries(game.scenes).forEach(([sceneId, commands]) => {
      assert(idPattern.test(sceneId) && Array.isArray(commands) && commands.length > 0, `INVALID_SCENE:${sceneId}`);
      commands.forEach((command) => {
        assert(isObject(command) && commandTypes.has(command.type), `UNKNOWN_COMMAND:${sceneId}`);
        if (command.type === "background") assert(Boolean(game.assets.backgrounds[command.asset]), `UNKNOWN_BACKGROUND:${command.asset}`);
        if (command.type === "character") assert(slots.has(command.slot) && Boolean(game.assets.characters[command.asset] || game.assets.enemies[command.asset]), `INVALID_CHARACTER:${command.asset}`);
        if (command.type === "characterHide") assert(slots.has(command.slot), `INVALID_SLOT:${command.slot}`);
        if (command.type === "message") assert(typeof command.text === "string" && command.text, `INVALID_MESSAGE:${sceneId}`);
        if (command.type === "choice") {
          assert(Array.isArray(command.options) && command.options.length >= 2, `INVALID_CHOICE:${sceneId}`);
          command.options.forEach((option) => assert(option && typeof option.text === "string" && option.text && game.scenes[option.scene], `INVALID_CHOICE_OPTION:${sceneId}`));
        }
        if (command.type === "jump") assert(Boolean(game.scenes[command.scene]), `UNKNOWN_SCENE:${command.scene}`);
        if (command.type === "branch") {
          assert(game.scenes[command.then] && game.scenes[command.else] && isObject(command.condition), `INVALID_BRANCH:${sceneId}`);
          const condition = command.condition;
          assert(Object.hasOwn(game.variables, condition.variable) && ["==", "!=", ">", ">=", "<", "<="].includes(condition.operator), `INVALID_CONDITION:${sceneId}`);
          assert(typeof game.variables[condition.variable] === typeof condition.value, `CONDITION_TYPE:${sceneId}`);
          if (typeof condition.value === "boolean") assert(["==", "!="].includes(condition.operator), `BOOLEAN_OPERATOR:${sceneId}`);
        }
        if (command.type === "set") assert(Object.hasOwn(game.variables, command.variable) && typeof game.variables[command.variable] === typeof command.value, `INVALID_SET:${sceneId}`);
        if (command.type === "add") {
          assert(typeof game.variables[command.variable] === "number", `INVALID_ADD_TARGET:${sceneId}`);
          const hasValue = typeof command.value === "number" && Number.isFinite(command.value);
          const hasSource = typeof game.variables[command.fromVariable] === "number";
          assert(hasValue !== hasSource, `INVALID_ADD_SOURCE:${sceneId}`);
        }
        if (command.type === "bgm") assert(Boolean(game.assets.bgm[command.asset]), `UNKNOWN_BGM:${command.asset}`);
        if (command.type === "se") assert(Boolean(game.assets.se[command.asset]), `UNKNOWN_SE:${command.asset}`);
        if (command.type === "event") validateEvent(command, game, registry);
      });
      assert(["jump", "branch", "choice", "end"].includes(commands[commands.length - 1].type), `SCENE_HAS_NO_EXIT:${sceneId}`);
    });
    return game;
  }

  window.SimpleAdvValidator = Object.freeze({ validate });
}());
