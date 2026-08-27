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
  environment: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "finanzas-m-plus" },
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
assert.equal(spawnCall[2].env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "finanzas-m-plus");

processRef.emit("SIGTERM");
assert.deepEqual(killedSignals, ["SIGTERM"]);
assert.equal(processRef.exitCode, undefined, "debe esperar close antes de cerrar");
child.emit("close", null, "SIGTERM");
assert.equal(processRef.exitCode, 0);
assert.equal(scheduledRestarts, 0);

console.log("OK dev-watch-supervisor");

// ─── Precalentado de rutas al arrancar ───────────────────────────────────────
//
// `next dev` compila cada ruta la PRIMERA vez que se pide (medido: 1,3-4 s por
// seccion, frente a ~0,25 s ya compilada). El supervisor lanza el precalentado
// para que ese coste se pague en segundo plano y no en el primer clic de cada
// seccion durante el QA. Y lo hace en CADA arranque, incluidos los reinicios:
// un reinicio tira toda la compilacion en memoria.

const warmChild = new EventEmitter();
const warmKills = [];
warmChild.kill = (signal) => {
  warmKills.push(signal);
  return true;
};

const serverChild = new EventEmitter();
serverChild.kill = () => true;

const warmProcessRef = new EventEmitter();
warmProcessRef.execPath = "C:/node/node.exe";
warmProcessRef.exitCode = undefined;

const spawns = [];
superviseNextDevelopment({
  environment: {},
  processRef: warmProcessRef,
  warmOnStart: true,
  spawnProcess: (...args) => {
    spawns.push(args);
    return spawns.length === 1 ? serverChild : warmChild;
  },
  scheduleRestart: () => 1,
  cancelRestart: () => {},
});

assert.equal(spawns.length, 2, "arrancar debe lanzar el servidor y el precalentado");
assert.deepEqual(spawns[0][1].slice(1), ["dev"], "el primero es el servidor");
// Se compara por segmentos y no con una expresion regular con separadores:
// en Windows la ruta viene con contrabarras y una regex mal escapada pasaba
// a comparar solo con barra normal, dando un falso negativo.
const warmScriptPath = spawns[1][1][0].split(/[\\/]/).slice(-2).join("/");
assert.equal(
  warmScriptPath,
  "scripts/warm-dev-routes.mjs",
  "el segundo proceso es el precalentado de rutas",
);

// Al apagar, el precalentado no puede quedarse vivo por su cuenta.
warmProcessRef.emit("SIGTERM");
assert.deepEqual(warmKills, ["SIGTERM"], "el precalentado se detiene con el servidor");

// Y sin la bandera no se lanza nada extra: las pruebas del supervisor no
// pueden arrancar un proceso de verdad.
const quietSpawns = [];
const quietChild = new EventEmitter();
quietChild.kill = () => true;
const quietProcessRef = new EventEmitter();
quietProcessRef.execPath = "C:/node/node.exe";
superviseNextDevelopment({
  environment: {},
  processRef: quietProcessRef,
  spawnProcess: (...args) => {
    quietSpawns.push(args);
    return quietChild;
  },
  scheduleRestart: () => 1,
  cancelRestart: () => {},
});
assert.equal(quietSpawns.length, 1, "sin warmOnStart solo se lanza el servidor");

console.log("OK dev-watch-supervisor (precalentado)");
