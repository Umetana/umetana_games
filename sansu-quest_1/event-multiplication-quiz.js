(function () {
  "use strict";

  const productPool = [...new Set(Array.from({ length: 9 }, (_, a) =>
    Array.from({ length: 9 }, (_, b) => (a + 1) * (b + 1))).flat())];

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function validateArgs(args, assets) {
    if (!args || !Array.isArray(args.rows) || args.rows.length === 0 ||
      !args.rows.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) ||
      new Set(args.rows).size !== args.rows.length) throw new Error("QUIZ_INVALID_ROWS");
    const max = args.rows.length * 9;
    if (!Number.isInteger(args.questionCount) || args.questionCount < 1 || args.questionCount > max) throw new Error("QUIZ_INVALID_COUNT");
    const required = args.requiredCorrect === undefined ? args.questionCount : args.requiredCorrect;
    if (!Number.isInteger(required) || required < 0 || required > args.questionCount) throw new Error("QUIZ_INVALID_REQUIRED");
    const presentation = args.presentation || {};
    if (presentation.allyCutin !== undefined && !assets.characters[presentation.allyCutin]) throw new Error("QUIZ_UNKNOWN_ALLY");
    if (presentation.enemy !== undefined && !assets.enemies[presentation.enemy]) throw new Error("QUIZ_UNKNOWN_ENEMY");
    return { rows: args.rows.slice(), questionCount: args.questionCount, requiredCorrect: required, presentation };
  }

  function makeQuestions(config) {
    return shuffle(config.rows.flatMap((row) => Array.from({ length: 9 }, (_, i) => ({ row, multiplier: i + 1, answer: row * (i + 1) }))))
      .slice(0, config.questionCount);
  }

  function makeAnswers(answer) {
    return shuffle([answer, ...shuffle(productPool.filter((n) => n !== answer)).slice(0, 3)]);
  }

  async function run(args, context) {
    const config = validateArgs(args, context.assets);
    const questions = makeQuestions(config);
    const root = context.root;
    let index = 0;
    let correct = 0;
    let wrong = 0;
    let locked = false;

    return new Promise((resolve, reject) => {
      function image(path, className, alt, fallbackText) {
        const img = document.createElement("img");
        img.className = className;
        img.src = path;
        img.alt = alt;
        img.addEventListener("error", () => { img.removeAttribute("src"); img.alt = fallbackText; img.classList.add("image-missing"); }, { once: true });
        return img;
      }

      function showCutin(isCorrect, enemy) {
        const allyId = config.presentation.allyCutin;
        if (!allyId && !enemy) return;
        const cutin = document.createElement("div");
        cutin.className = `cutin${isCorrect ? "" : " miss"}`;
        if (allyId) cutin.append(image(context.assets.characters[allyId], "", "弓をかまえるエルマ", "エルマ"));
        const arrow = document.createElement("span");
        arrow.className = "light-arrow";
        cutin.append(arrow);
        root.append(cutin);
        if (enemy && isCorrect) enemy.classList.add("hit");
        window.setTimeout(() => cutin.remove(), 800);
      }

      function renderQuestion() {
        locked = false;
        root.replaceChildren();
        const q = questions[index];
        const card = document.createElement("div");
        card.className = "quiz-card";
        const progress = document.createElement("div");
        progress.className = "quiz-progress";
        progress.textContent = `${index + 1} / ${questions.length}`;
        card.append(progress);
        let enemy = null;
        if (config.presentation.enemy) {
          enemy = image(context.assets.enemies[config.presentation.enemy], "quiz-enemy", "にのだんスライム", "スライム");
          card.append(enemy);
        }
        const formula = document.createElement("h1");
        formula.className = "quiz-formula";
        formula.textContent = `${q.row} × ${q.multiplier} = ?`;
        card.append(formula);
        const help = document.createElement("p");
        help.className = "quiz-help";
        help.textContent = "こたえを ひとつ えらんでね";
        card.append(help);
        const answers = document.createElement("div");
        answers.className = "answers";
        const values = makeAnswers(q.answer);
        values.forEach((value) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "answer";
          button.textContent = String(value);
          button.setAttribute("aria-label", `こたえ ${value}`);
          button.addEventListener("click", () => answerQuestion(value, button, answers, q, card, enemy), { once: true });
          answers.append(button);
        });
        card.append(answers);
        const feedback = document.createElement("div");
        feedback.className = "feedback";
        feedback.setAttribute("aria-live", "assertive");
        card.append(feedback);
        root.append(card);
        answers.querySelector("button").focus();
      }

      function answerQuestion(value, selected, answers, q, card, enemy) {
        if (locked) return;
        locked = true;
        const isCorrect = value === q.answer;
        isCorrect ? correct += 1 : wrong += 1;
        [...answers.children].forEach((button) => {
          button.disabled = true;
          if (Number(button.textContent) === q.answer) button.classList.add("correct");
        });
        if (!isCorrect) selected.classList.add("wrong");
        const feedback = card.querySelector(".feedback");
        feedback.classList.add(isCorrect ? "good" : "try");
        feedback.textContent = isCorrect ? `せいかい！\n${q.row} × ${q.multiplier} = ${q.answer}` : `おしい！ えらんだ こたえは ${value}\n${q.row} × ${q.multiplier} = ${q.answer}`;
        showCutin(isCorrect, enemy);
        const next = document.createElement("button");
        next.type = "button";
        next.className = "next-question";
        next.textContent = index + 1 === questions.length ? "けっかへ" : "つぎへ";
        next.addEventListener("click", () => {
          if (next.disabled) return;
          next.disabled = true;
          index += 1;
          if (index < questions.length) renderQuestion(); else renderResult();
        });
        card.append(next);
        next.focus();
      }

      function renderResult() {
        const cleared = correct >= config.requiredCorrect;
        root.replaceChildren();
        const card = document.createElement("div");
        card.className = "quiz-card";
        const panel = document.createElement("div");
        panel.className = "result-panel";
        const title = document.createElement("h2");
        title.textContent = cleared ? "ごうかく！" : "よく がんばったね！";
        const summary = document.createElement("p");
        summary.className = "score";
        summary.textContent = `せいかい ${correct} / ${questions.length}\nおしい ${wrong}`;
        summary.style.whiteSpace = "pre-line";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "return-adv";
        back.textContent = "ものがたりへ もどる";
        back.addEventListener("click", () => {
          if (back.disabled) return;
          back.disabled = true;
          resolve({ correct, wrong, cleared });
        });
        panel.append(title, summary, back);
        card.append(panel);
        root.append(card);
        back.focus();
      }

      try { renderQuestion(); } catch (error) { reject(error); }
    });
  }

  window.SimpleAdvEventRegistry.register("multiplicationQuiz", {
    validate: validateArgs,
    run,
    resultTypes: Object.freeze({ correct: "number", wrong: "number", cleared: "boolean" })
  });
  window.MultiplicationQuizTest = Object.freeze({ validateArgs, makeQuestions, makeAnswers });
}());
