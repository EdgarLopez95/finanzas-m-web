import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { superviseNextDevelopment } from "../../scripts/dev-watch.mjs";

const child = new EventEmitter();
const killedSignals = [];
child.kill = (signal) => {
  killedSignals.push(signal);
  return true;
};

const processRef = new EventEmitter();
processRef.execPath = "C:/node/node.exe";
processRef.exitCode = undefined;

let spawnCall;
let scheduledRestarts = 0;
superviseNextDevelopment({
  environment: { NEXT_PUBLIC_FIREBASE_RUNTIME: "EMULATOR" },
  processRef,
  spawnProcess: (...args) => {
    spawnCall = args;
    return child;
  },
  scheduleRestart: () => {
    scheduledRestarts += 1;
    return 1;
  },
  cancelRestart: () => {},
});

assert.equal(spawnCall[0], processRef.execPath);
assert.match(spawnCall[1][0], /node_modules[\\/]next[\\/]dist[\\/]bin[\\/]next$/);
assert.deepEqual(spawnCall[1].slice(1), ["dev"]);
assert.equal(spawnCall[2].shell, false);
assert.equal(spawnCall[2].env.NEXT_PUBLIC_FIREBASE_RUNTIME, "EMULATOR");

processRef.emit("SIGTERM");
assert.deepEqual(killedSignals, ["SIGTERM"]);
assert.equal(processRef.exitCode, undefined, "debe esperar close antes de cerrar");
child.emit("close", null, "SIGTERM");
assert.equal(processRef.exitCode, 0);
assert.equal(scheduledRestarts, 0);

console.log("OK dev-watch-supervisor");
