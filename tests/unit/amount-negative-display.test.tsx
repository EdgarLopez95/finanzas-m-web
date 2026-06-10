import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Amount } from "@/components/finance/amount";

const heroNegativeMarkup = renderToStaticMarkup(
  <Amount showSign={false} size="display" value={-80_000} />
);

assert.match(
  heroNegativeMarkup,
  /-\s*\$\s?80\.000/,
  "cuando showSign es false, los montos negativos deben conservar el signo menos"
);

const incomeMarkup = renderToStaticMarkup(
  <Amount showSign={false} size="md" value={20_000} variant="income" />
);

assert.doesNotMatch(
  incomeMarkup,
  /-\s*\$\s?20\.000/,
  "los montos positivos no deben mostrar signo negativo al ocultar prefijos de tipo"
);

console.log("OK amount-negative-display");
