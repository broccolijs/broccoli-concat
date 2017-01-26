const path = require('path');
const walkSync = require('walk-sync');
const { average, stripExtension } = require('./utilities');

// We add an extra iteration to account for cache warming on the first run
const iterations = (parseInt(process.env.ITERATIONS, 10) || 1) + 1;
const suitesDir = path.join(__dirname, 'suites');

/**
 * A simple benchmark runner that finds all JS files exported in the `suites`
 * directory and executes predefined hooks in them.
 *
 *  setup: Runs once before all of the scenario iterations
 *  beforeScenario: Runs once before each of the scenario iterations
 *  scenario: The benchmark scenario for which time is recorded
 *  afterScenario: Runs once after each of the scenario iterations
 *  cleanup: Runs once after all of the scenario iterations
 *
 * Each hook is invoked with a `context` object that is empty by default. This
 * allows information to be shared between the hooks.
 */
walkSync(suitesDir).reduce(function(chain, file) {
  const suite = require(path.join(suitesDir, file));

  const context = {};
  const times = [];

  chain = chain.then(() => suite.setup.call(context));

  for (let i = 0; i < iterations; i++) {
    chain = chain
      .then(() => suite.beforeScenario && suite.beforeScenario.call(context))
      .then(() => {
        let startTime = Date.now();
        let scenarioPromise = Promise.resolve(suite.scenario.call(context));
        return scenarioPromise.then(() => {
          if (i === 0) { return; }

          let elapsedTime = Date.now() - startTime;
          times.push(elapsedTime);
        });
      })
      .then(() => suite.afterScenario && suite.afterScenario.call(context));
  }

  return chain
    .then(() => suite.cleanup.call(context))
    .then(() => {
      console.log(`Average time for ${stripExtension(file)} over ${iterations} iterations: ${average(times)}ms`);
      console.log(`FILE_COUNT: ${process.env.FILE_COUNT || 10}`);
      console.log(`DEPTH: ${process.env.DEPTH || 1}`);
      console.log(`LARGE_FILES: ${!!process.env.LARGE_FILES}`);
    });
}, Promise.resolve());
