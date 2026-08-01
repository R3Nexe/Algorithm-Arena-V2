# C Driver + Language Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every language in the challenge editor dropdown (JS, Python, Java, C++, C) executes test cases LeetCode-style, and non-runnable languages are disabled per-challenge.

**Architecture:** A new `buildCDriver` codegen in the shared driver module synthesizes LeetCode's C calling convention (size params, `returnSize` out-param) from stored challenge metadata. `isDrivableSignature` gains a language-aware depth cap (C: 1-D, Java/C++: 2-D). Both apps' editors disable compiled-language options whose signature isn't drivable. A permanent Node verification harness compiles and runs generated drivers with local toolchains.

**Tech Stack:** Plain ESM JS (`shared/lib/leetcodeDriver.js`), generated C (GCC/Judge0 id 50), React (client + admin-client), Node script for verification.

**Spec:** `docs/superpowers/specs/2026-07-14-c-driver-leetcode-execution-design.md`

## Global Constraints

- `shared/lib/leetcodeDriver.js` is consumed only by the two Vite apps (server never imports it); it is re-exported verbatim by `client/src/lib/leetcodeDriver.js` and `admin-client/src/lib/leetcodeDriver.js`.
- C tier: supported bases (`integer`, `long`, `double`, `boolean`, `string`, `character`) at depth ≤ 1; Java/C++ keep depth ≤ 2; `void` return allowed for all three (prints mutated first argument).
- Driver errors go to stderr + non-zero exit, matching existing drivers.
- All harness output comparisons are JSON-parsed deep-equals (Python prints `[1, 3]` with spaces; that must compare equal to `[1,3]`).
- The repo root `package.json` has no `"type"` field (CJS default). Node can only `import` `shared/lib/*.js` after Task 1 adds `shared/package.json` with `"type": "module"`.
- There is an **uncommitted, already-verified change** in `shared/lib/leetcodeDriver.js` (void-return support for Java/C++/Python/JS). Task 1 commits it first — do not revert it.
- `docs/` is gitignored — never `git add` spec/plan files.

---

### Task 1: Commit pending void fix; make `shared/` Node-ESM; add verification harness (baseline green)

**Files:**
- Modify: (commit only) `shared/lib/leetcodeDriver.js` — already contains the void-return fix
- Create: `shared/package.json`
- Create: `shared/lib/verify-drivers.mjs`

**Interfaces:**
- Consumes: existing exports of `shared/lib/leetcodeDriver.js`: `wrapWithDriver(code, language, functionName, params, returnType) → string`, `isDrivableSignature(language, params, returnType) → boolean`.
- Produces: `node shared/lib/verify-drivers.mjs` — exits 0 when all driver cases pass, 1 on any failure; Task 2 adds C cases to its `CASES` array.

- [ ] **Step 1: Commit the pending void-return fix**

```bash
cd /Users/r3nexe/dev/Projects/Algorithm-Arena-V2
git add shared/lib/leetcodeDriver.js
git commit -m "fix: run in-place (void) problems via drivers in all languages

void-returning signatures (reverseString, moveZeroes) previously fell back
to raw code, which always crashes on Judge0 for Java/C++ and printed null
for Python/JS. Drivers now print the mutated first argument, matching the
LeetCode judge convention.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Create `shared/package.json`**

```json
{
  "name": "algorithm-arena-shared",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 3: Create the harness `shared/lib/verify-drivers.mjs`**

```js
// Compiles and runs generated drivers with local toolchains, exactly the way
// Judge0 does (java Main / gcc / g++ / python3 / node). Exits 1 on any failure.
// Usage: node shared/lib/verify-drivers.mjs
import { wrapWithDriver, isDrivableSignature } from "./leetcodeDriver.js";
import { execSync, spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const has = (bin) => {
  try { execSync(`command -v ${bin}`, { stdio: "ignore" }); return true; }
  catch { return false; }
};

const SOLUTIONS = {
  twoSum: {
    functionName: "twoSum",
    params: [{ name: "nums", type: "integer[]" }, { name: "target", type: "integer" }],
    returnType: "integer[]",
    stdin: '[2,7,11,15]\n9\n',
    expected: [0, 1],
    code: {
      javascript: `var twoSum = function(nums, target) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return [i, j];
  return [];
};`,
      python: `class Solution:
    def twoSum(self, nums, target):
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
        return []`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] + nums[j] == target) return new int[]{i, j};
        return new int[]{};
    }
}`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < (int)nums.size(); i++)
            for (int j = i + 1; j < (int)nums.size(); j++)
                if (nums[i] + nums[j] == target) return {i, j};
        return {};
    }
};`,
    },
  },
  moveZeroes: {
    functionName: "moveZeroes",
    params: [{ name: "nums", type: "integer[]" }],
    returnType: "void",
    stdin: '[0,1,0,3,12]\n',
    expected: [1, 3, 12, 0, 0],
    code: {
      javascript: `var moveZeroes = function(nums) {
  let left = 0;
  for (let right = 0; right < nums.length; right++) {
    if (nums[right] !== 0) { [nums[left], nums[right]] = [nums[right], nums[left]]; left++; }
  }
};`,
      python: `class Solution:
    def moveZeroes(self, nums):
        left = 0
        for right in range(len(nums)):
            if nums[right] != 0:
                nums[left], nums[right] = nums[right], nums[left]
                left += 1`,
      java: `class Solution {
    public void moveZeroes(int[] nums) {
        int left = 0;
        for (int right = 0; right < nums.length; right++) {
            if (nums[right] != 0) {
                int t = nums[right]; nums[right] = nums[left]; nums[left] = t; left++;
            }
        }
    }
}`,
      cpp: `class Solution {
public:
    void moveZeroes(vector<int>& nums) {
        int left = 0;
        for (int right = 0; right < (int)nums.size(); right++)
            if (nums[right] != 0) swap(nums[left++], nums[right]);
    }
};`,
    },
  },
};

// Task 2 appends C solutions/cases here.
const CASES = [];
for (const [name, s] of Object.entries(SOLUTIONS)) {
  for (const [language, code] of Object.entries(s.code)) {
    CASES.push({ name: `${name}/${language}`, language, code,
      functionName: s.functionName, params: s.params, returnType: s.returnType,
      stdin: s.stdin, expected: s.expected });
  }
}

const GATE_CHECKS = [
  // [description, actual, expectedBool]
  ["java twoSum drivable", isDrivableSignature("java", SOLUTIONS.twoSum.params, "integer[]"), true],
  ["java void drivable", isDrivableSignature("java", SOLUTIONS.moveZeroes.params, "void"), true],
  ["cpp depth-2 drivable", isDrivableSignature("cpp", [{ type: "list<list<integer>>" }], "integer"), true],
  ["unknown lang not drivable", isDrivableSignature("ruby", SOLUTIONS.twoSum.params, "integer[]"), false],
];

const dir = mkdtempSync(join(tmpdir(), "driver-verify-"));
let failures = 0;
const fail = (msg) => { failures++; console.error(`  FAIL ${msg}`); };

for (const [desc, actual, expected] of GATE_CHECKS) {
  if (actual !== expected) fail(`${desc}: expected ${expected}, got ${actual}`);
  else console.log(`  ok   ${desc}`);
}

const PORTABLE_CPP_HEADERS =
  "#include <vector>\n#include <string>\n#include <iostream>\n#include <sstream>\n#include <stdexcept>\n#include <cctype>\n#include <algorithm>\n";

const runCase = (c, idx) => {
  const src = wrapWithDriver(c.code, c.language, c.functionName, c.params, c.returnType);
  let cmd;
  if (c.language === "javascript") {
    const f = join(dir, `case${idx}.js`); writeFileSync(f, src); cmd = ["node", [f]];
  } else if (c.language === "python") {
    const f = join(dir, `case${idx}.py`); writeFileSync(f, src); cmd = ["python3", [f]];
  } else if (c.language === "java") {
    if (!has("javac")) { console.log(`  skip ${c.name} (no javac)`); return; }
    const d = join(dir, `case${idx}`); mkdirSync(d);
    writeFileSync(join(d, "Main.java"), src);
    execSync(`javac Main.java`, { cwd: d });
    cmd = ["java", ["-cp", d, "Main"]];
  } else if (c.language === "cpp") {
    if (!has("g++")) { console.log(`  skip ${c.name} (no g++)`); return; }
    // macOS clang lacks bits/stdc++.h; swap it for portable headers (test-only).
    const portable = src.replace("#include <bits/stdc++.h>", PORTABLE_CPP_HEADERS);
    const f = join(dir, `case${idx}.cpp`); const bin = join(dir, `case${idx}_cpp`);
    writeFileSync(f, portable);
    execSync(`g++ -std=c++17 -o ${bin} ${f}`);
    cmd = [bin, []];
  } else if (c.language === "c") {
    if (!has("gcc")) { console.log(`  skip ${c.name} (no gcc)`); return; }
    const f = join(dir, `case${idx}.c`); const bin = join(dir, `case${idx}_c`);
    writeFileSync(f, src);
    execSync(`gcc -std=gnu11 -o ${bin} ${f}`);
    cmd = [bin, []];
  } else {
    fail(`${c.name}: unknown language`); return;
  }
  const res = spawnSync(cmd[0], cmd[1], { input: c.stdin, encoding: "utf-8", timeout: 15000 });
  if (res.status !== 0) { fail(`${c.name}: exit ${res.status}\n${res.stderr}`); return; }
  let parsed;
  try { parsed = JSON.parse(res.stdout.trim()); }
  catch { fail(`${c.name}: non-JSON stdout: ${JSON.stringify(res.stdout)}`); return; }
  if (JSON.stringify(parsed) !== JSON.stringify(c.expected)) {
    fail(`${c.name}: expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(parsed)}`);
  } else {
    console.log(`  ok   ${c.name}`);
  }
};

try {
  CASES.forEach((c, i) => {
    try { runCase(c, i); }
    catch (e) { fail(`${c.name}: ${e.message}`); } // compile errors count as case failures
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 4: Run the harness — baseline must pass**

Run: `node shared/lib/verify-drivers.mjs`
Expected: `ok` lines for all gate checks and all 8 cases (twoSum + moveZeroes × js/python/java/cpp), ending `ALL PASS`, exit 0. (Java/C++ skip with a warning if toolchains are missing — on this machine `javac`, `g++`, `gcc` all exist.)

- [ ] **Step 5: Commit**

```bash
git add shared/package.json shared/lib/verify-drivers.mjs
git commit -m "test: add driver verification harness for all runner languages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: C driver codegen in `shared/lib/leetcodeDriver.js`

**Files:**
- Modify: `shared/lib/leetcodeDriver.js` (functions `isSupportedType`, `isDrivableSignature`, new `C_BASE` + `buildCDriver`, branch in `wrapWithDriver`)
- Modify: `shared/lib/verify-drivers.mjs` (add C cases + C gate checks)

**Interfaces:**
- Consumes: existing `parseType(raw) → { base, depth }`, `isVoidReturn(returnType) → boolean`, `SUPPORTED_BASES` set — all already defined in the module.
- Produces: `isDrivableSignature("c", params, returnType)` returns true for depth ≤ 1 signatures; `wrapWithDriver(code, "c", functionName, params, returnType)` returns a complete compilable C program. Tasks 3–4 rely only on `isDrivableSignature`.

- [ ] **Step 1: Add failing C cases to the harness**

In `shared/lib/verify-drivers.mjs`, add C code to the two existing solutions and three new C-only solutions. Add to `SOLUTIONS.twoSum.code`:

```js
      c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    for (int i = 0; i < numsSize; i++)
        for (int j = i + 1; j < numsSize; j++)
            if (nums[i] + nums[j] == target) {
                int* r = (int*)malloc(2 * sizeof(int));
                r[0] = i; r[1] = j; *returnSize = 2;
                return r;
            }
    *returnSize = 0;
    return NULL;
}`,
```

Add to `SOLUTIONS.moveZeroes.code`:

```js
      c: `void moveZeroes(int* nums, int numsSize) {
    int left = 0;
    for (int right = 0; right < numsSize; right++)
        if (nums[right] != 0) {
            int t = nums[right]; nums[right] = nums[left]; nums[left] = t; left++;
        }
}`,
```

Add three new entries to `SOLUTIONS` (C-only coverage of `char[]` void, `string → boolean`, `string[] → string`):

```js
  reverseStringC: {
    functionName: "reverseString",
    params: [{ name: "s", type: "character[]" }],
    returnType: "void",
    stdin: '["h","e","l","l","o"]\n',
    expected: ["o", "l", "l", "e", "h"],
    code: {
      c: `void reverseString(char* s, int sSize) {
    int i = 0, j = sSize - 1;
    while (i < j) { char t = s[i]; s[i] = s[j]; s[j] = t; i++; j--; }
}`,
    },
  },
  isPalindromeC: {
    functionName: "isPalindrome",
    params: [{ name: "s", type: "string" }],
    returnType: "boolean",
    stdin: '"aba"\n',
    expected: true,
    code: {
      c: `bool isPalindrome(char* s) {
    int i = 0, j = (int)strlen(s) - 1;
    while (i < j) { if (s[i] != s[j]) return false; i++; j--; }
    return true;
}`,
    },
  },
  longestCommonPrefixC: {
    functionName: "longestCommonPrefix",
    params: [{ name: "strs", type: "string[]" }],
    returnType: "string",
    stdin: '["flower","flow","flight"]\n',
    expected: "fl",
    code: {
      c: `char* longestCommonPrefix(char** strs, int strsSize) {
    if (strsSize == 0) { char* e = (char*)malloc(1); e[0] = 0; return e; }
    int len = (int)strlen(strs[0]);
    for (int i = 1; i < strsSize; i++) {
        int j = 0;
        while (j < len && strs[i][j] == strs[0][j]) j++;
        len = j;
    }
    char* out = (char*)malloc(len + 1);
    memcpy(out, strs[0], len); out[len] = 0;
    return out;
}`,
    },
  },
```

Add to `GATE_CHECKS`:

```js
  ["c twoSum drivable", isDrivableSignature("c", [{ type: "integer[]" }, { type: "integer" }], "integer[]"), true],
  ["c void drivable", isDrivableSignature("c", [{ type: "integer[]" }], "void"), true],
  ["c string[] drivable", isDrivableSignature("c", [{ type: "string[]" }], "string"), true],
  ["c depth-2 NOT drivable", isDrivableSignature("c", [{ type: "list<list<integer>>" }], "integer"), false],
  ["java depth-2 still drivable", isDrivableSignature("java", [{ type: "list<list<integer>>" }], "integer"), true],
```

- [ ] **Step 2: Run harness to verify the new cases fail**

Run: `node shared/lib/verify-drivers.mjs`
Expected: baseline cases still `ok`; the 4 new C gate checks FAIL (`isDrivableSignature("c", ...)` currently returns false); the 5 C compile cases FAIL (raw C code has no `main` → `gcc` link error `undefined reference to _main` / `undefined symbols`). Exit 1.

- [ ] **Step 3: Implement C support in `shared/lib/leetcodeDriver.js`**

3a. Replace `isSupportedType` and `isDrivableSignature`:

```js
const isSupportedType = (raw, maxDepth = 2) => {
  const { base, depth } = parseType(raw);
  return SUPPORTED_BASES.has(base) && depth <= maxDepth;
};
```

```js
export const isDrivableSignature = (language, params, returnType) => {
  if (language !== "java" && language !== "cpp" && language !== "c") return false;
  if (!Array.isArray(params) || params.length === 0) return false;
  const maxDepth = language === "c" ? 1 : 2; // C convention synthesis is 1-D only
  if (!params.every((p) => isSupportedType(p?.type, maxDepth))) return false;
  return isSupportedType(returnType, maxDepth) || isVoidReturn(returnType);
};
```

3b. Add the C codegen block after `buildCppDriver`:

```js
// --- C codegen helpers --------------------------------------------------------
// LeetCode's C convention: each array param carries a trailing `int <arg>Size`,
// array returns receive a final `int* returnSize` out-param, and strings are
// plain char* with no size. All of it is synthesized from the stored metadata.
const C_BASE = {
  integer:   { cType: "int",       parseScalar: "(int)parseInt()", arrParser: "parseIntArr",  printExpr: (v) => `printf("%d", ${v})` },
  long:      { cType: "long long", parseScalar: "parseInt()",      arrParser: "parseLLArr",   printExpr: (v) => `printf("%lld", ${v})` },
  double:    { cType: "double",    parseScalar: "parseDouble()",   arrParser: "parseDblArr",  printExpr: (v) => `printf("%g", ${v})` },
  boolean:   { cType: "bool",      parseScalar: "parseBool()",     arrParser: "parseBoolArr", printExpr: (v) => `printf("%s", ${v} ? "true" : "false")` },
  character: { cType: "char",      parseScalar: "parseCharVal()",  arrParser: "parseCharArr", printExpr: (v) => `printCharJson(${v})` },
  string:    { cType: "char*",     parseScalar: "parseStr()",      arrParser: "parseStrArr",  printExpr: (v) => `printEscStr(${v})` },
};

const C_HELPERS = String.raw`static char* _J; static size_t _P;
static void _fail(const char* msg) { fprintf(stderr, "Driver: %s\n", msg); exit(1); }
static void _skip(void) { while (_J[_P] && isspace((unsigned char)_J[_P])) _P++; }
static char* _dup(const char* s) {
    size_t n = strlen(s);
    char* out = (char*)malloc(n + 1);
    memcpy(out, s, n + 1);
    return out;
}
static long long parseInt(void) {
    _skip();
    size_t s = _P;
    if (_J[_P] == '-' || _J[_P] == '+') _P++;
    while (isdigit((unsigned char)_J[_P])) _P++;
    return strtoll(_J + s, NULL, 10);
}
static double parseDouble(void) {
    _skip();
    size_t s = _P;
    while (_J[_P]) {
        char c = _J[_P];
        if (isdigit((unsigned char)c) || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') _P++;
        else break;
    }
    return strtod(_J + s, NULL);
}
static bool parseBool(void) { _skip(); if (_J[_P] == 't') { _P += 4; return true; } _P += 5; return false; }
static char* parseStr(void) {
    _skip();
    size_t cap = 16, len = 0;
    char* out = (char*)malloc(cap);
    _P++; /* opening quote */
    while (_J[_P] && _J[_P] != '"') {
        char c = _J[_P++];
        if (c == '\\' && _J[_P]) {
            char e = _J[_P++];
            if (e == 'n') c = '\n';
            else if (e == 't') c = '\t';
            else if (e == 'r') c = '\r';
            else c = e;
        }
        if (len + 1 >= cap) { cap *= 2; out = (char*)realloc(out, cap); }
        out[len++] = c;
    }
    _P++; /* closing quote */
    out[len] = '\0';
    return out;
}
static char parseCharVal(void) { char* s = parseStr(); char c = s[0]; free(s); return c; }
#define DEF_ARR_PARSER(NAME, T, PARSE_ELEM) \
static T* NAME(int* n) { \
    _skip(); _P++; _skip(); \
    size_t cap = 8; int cnt = 0; \
    T* a = (T*)malloc(cap * sizeof(T)); \
    if (_J[_P] == ']') { _P++; *n = 0; return a; } \
    while (1) { \
        if ((size_t)cnt >= cap) { cap *= 2; a = (T*)realloc(a, cap * sizeof(T)); } \
        a[cnt++] = PARSE_ELEM; \
        _skip(); \
        char c = _J[_P++]; \
        if (c == ']') break; \
    } \
    *n = cnt; return a; \
}
DEF_ARR_PARSER(parseIntArr, int, (int)parseInt())
DEF_ARR_PARSER(parseLLArr, long long, parseInt())
DEF_ARR_PARSER(parseDblArr, double, parseDouble())
DEF_ARR_PARSER(parseBoolArr, bool, parseBool())
DEF_ARR_PARSER(parseCharArr, char, parseCharVal())
DEF_ARR_PARSER(parseStrArr, char*, parseStr())
static void printEscStr(const char* s) {
    putchar('"');
    for (size_t i = 0; s[i]; i++) {
        char c = s[i];
        if (c == '"') printf("\\\"");
        else if (c == '\\') printf("\\\\");
        else if (c == '\n') printf("\\n");
        else if (c == '\t') printf("\\t");
        else if (c == '\r') printf("\\r");
        else putchar(c);
    }
    putchar('"');
}
static void printCharJson(char v) { char t[2] = { v, 0 }; printEscStr(t); }
`;

const buildCDriver = (code, functionName, params, returnType) => {
  const descriptors = params.map((p) => parseType(p.type));

  const argDecls = descriptors
    .map((d, i) => {
      const base = C_BASE[d.base];
      const guard =
        `    if (${i} >= (int)nLines) _fail("missing input line ${i}");\n` +
        `    _J = lineBufs[${i}]; _P = 0;\n`;
      if (d.depth === 0) return `${guard}    ${base.cType} arg${i} = ${base.parseScalar};`;
      return `${guard}    int arg${i}Size = 0;\n    ${base.cType}* arg${i} = ${base.arrParser}(&arg${i}Size);`;
    })
    .join("\n");

  const callArgs = descriptors
    .flatMap((d, i) => (d.depth === 0 ? [`arg${i}`] : [`arg${i}`, `arg${i}Size`]))
    .join(", ");

  const printArrayStmt = (base, expr, sizeExpr) =>
    `printf("[");\n` +
    `    for (int _i = 0; _i < ${sizeExpr}; _i++) { if (_i) printf(","); ${C_BASE[base].printExpr(`${expr}[_i]`)}; }\n` +
    `    printf("]\\n");`;

  const ret = parseType(returnType);
  let invocation;
  if (isVoidReturn(returnType)) {
    // In-place method: print the mutated first argument.
    const d0 = descriptors[0];
    const printFirst = d0.depth === 0
      ? `${C_BASE[d0.base].printExpr("arg0")}; printf("\\n");`
      : printArrayStmt(d0.base, "arg0", "arg0Size");
    invocation = `    ${functionName}(${callArgs});\n    ${printFirst}`;
  } else if (ret.depth === 0) {
    invocation =
      `    ${C_BASE[ret.base].cType} _result = ${functionName}(${callArgs});\n` +
      `    ${C_BASE[ret.base].printExpr("_result")}; printf("\\n");`;
  } else {
    // Array return: LeetCode's C convention passes int* returnSize as the last arg.
    invocation =
      `    int returnSize = 0;\n` +
      `    ${C_BASE[ret.base].cType}* _result = ${functionName}(${callArgs}, &returnSize);\n` +
      `    ${printArrayStmt(ret.base, "_result", "returnSize")}`;
  }

  return `#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>

${code}

// --- DRIVER CODE ---
${C_HELPERS}
int main(void) {
    char* lineBufs[16];
    size_t nLines = 0;
    char* buf = NULL;
    size_t bufCap = 0;
    while (getline(&buf, &bufCap, stdin) != -1) {
        char* p = buf;
        while (*p && isspace((unsigned char)*p)) p++;
        if (!*p) continue;
        if (nLines < 16) lineBufs[nLines++] = _dup(buf);
    }
${argDecls}
${invocation}
    return 0;
}
`;
};
```

3c. Add the branch in `wrapWithDriver`, directly after the existing `cpp` branch:

```js
  if (language === "c" && isDrivableSignature(language, params, returnType)) {
    return buildCDriver(code, functionName, params, returnType);
  }
```

- [ ] **Step 4: Run harness to verify everything passes**

Run: `node shared/lib/verify-drivers.mjs`
Expected: all gate checks `ok` (including the 4 C checks and the java depth-2 regression check), all 13 cases `ok` (8 baseline + 5 C), `ALL PASS`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add shared/lib/leetcodeDriver.js shared/lib/verify-drivers.mjs
git commit -m "feat: add C driver — LeetCode-style execution for all editor languages

Synthesizes LeetCode's C calling convention (array size params, returnSize
out-param) from challenge metadata. C tier: scalars, strings, 1-D arrays,
void/in-place. Verified end-to-end with gcc via the driver harness.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Participant editor — disable non-runnable languages

**Files:**
- Modify: `client/src/pages/ChallengeDetails.jsx` (language `Select` around lines 826–841; add helper + effect near other hooks)
- Check: `client/src/components/ui/select.jsx` (SelectItem must render disabled state)

**Interfaces:**
- Consumes: `isDrivableSignature(language, params, returnType)` — already imported at `client/src/pages/ChallengeDetails.jsx:48`; `LANGUAGE_OPTIONS` from `../constants/languages`; `challengeQuery` (React Query result holding the challenge doc with `functionName`, `params`, `returnType`).
- Produces: nothing consumed by later tasks (Task 4 repeats the same pattern for admin independently).

- [ ] **Step 1: Add the runnability helper and fallback effect**

In the `ChallengeDetails` component body (after `challengeQuery` is defined, near the other `useEffect` hooks), add:

```jsx
  // A language is offered only if this challenge can actually run in it.
  // Python/JS drivers are dynamic; compiled languages need a drivable signature.
  // Manual-stdin challenges (no functionName) are never gated.
  const isLanguageRunnable = (langKey) => {
    const ch = challengeQuery.data;
    if (!ch?.functionName) return true;
    if (langKey === "python" || langKey === "javascript") return true;
    return isDrivableSignature(langKey, ch.params, ch.returnType);
  };

  useEffect(() => {
    if (!challengeQuery.data) return;
    if (!isLanguageRunnable(language)) {
      const firstRunnable = LANGUAGE_OPTIONS.find((o) => isLanguageRunnable(o.key));
      if (firstRunnable) setLanguage(firstRunnable.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeQuery.data, language]);
```

- [ ] **Step 2: Gate the dropdown options**

Replace the `LANGUAGE_OPTIONS.map` inside the `Select` (currently lines 835–839):

```jsx
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const runnable = isLanguageRunnable(opt.key);
                      return (
                        <SelectItem
                          key={opt.key}
                          value={opt.key}
                          disabled={!runnable}
                          className="text-xs"
                        >
                          {opt.label}{opt.version && ` (${opt.version})`}{!runnable && " — no runner"}
                        </SelectItem>
                      );
                    })}
```

- [ ] **Step 3: Verify SelectItem renders a disabled state**

Open `client/src/components/ui/select.jsx` and confirm the `SelectItem` wrapper spreads props onto `SelectPrimitive.Item` (Radix supports `disabled` natively) and its className includes disabled styling such as `data-[disabled]:pointer-events-none data-[disabled]:opacity-50`. If the disabled styling classes are missing, add them to the wrapper's base className string.

- [ ] **Step 4: Lint**

Run: `cd client && npx eslint src/pages/ChallengeDetails.jsx src/components/ui/select.jsx`
Expected: no errors (React-version warning is pre-existing noise).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ChallengeDetails.jsx client/src/components/ui/select.jsx
git commit -m "feat: disable non-runnable languages in participant editor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Admin editor gating + SignatureInfo C indicator

**Files:**
- Modify: `admin-client/src/pages/ChallengeDetails.jsx` (native `<select>` around lines 636–647; helper + effect near other hooks)
- Modify: `admin-client/src/pages/admin/QuestionSetsTab.jsx` (`SignatureInfo`, lines 16–32)

**Interfaces:**
- Consumes: `isDrivableSignature` — already imported at `admin-client/src/pages/ChallengeDetails.jsx:29` and in `QuestionSetsTab.jsx` via `../../lib/leetcodeDriver`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add helper + fallback effect to admin ChallengeDetails**

Same pattern as Task 3, with one difference: the admin page has an `isReviewMode` flag (submission review displays code in its original language). Do not force-switch languages in review mode.

```jsx
  const isLanguageRunnable = (langKey) => {
    const ch = challengeQuery.data;
    if (!ch?.functionName) return true;
    if (langKey === "python" || langKey === "javascript") return true;
    return isDrivableSignature(langKey, ch.params, ch.returnType);
  };

  useEffect(() => {
    if (!challengeQuery.data || isReviewMode) return;
    if (!isLanguageRunnable(language)) {
      const firstRunnable = LANGUAGE_OPTIONS.find((o) => isLanguageRunnable(o.key));
      if (firstRunnable) setLanguage(firstRunnable.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeQuery.data, language, isReviewMode]);
```

(If the challenge query variable in this file has a different name — check the top of the component; it is the `useQuery` result fetching `/api/challenges/:id` — use that name consistently.)

- [ ] **Step 2: Gate the native select options (lines 642–646)**

```jsx
                {LANGUAGE_OPTIONS.map((opt) => {
                  const runnable = isLanguageRunnable(opt.key);
                  return (
                    <option
                      key={opt.key}
                      value={opt.key}
                      disabled={!runnable}
                      className="bg-white dark:bg-[#1a1a24] text-black dark:text-white"
                    >
                      {opt.label}{opt.version && ` (${opt.version})`}{!runnable && " — no runner"}
                    </option>
                  );
                })}
```

- [ ] **Step 3: Add the C indicator to SignatureInfo**

In `admin-client/src/pages/admin/QuestionSetsTab.jsx`, `SignatureInfo` (lines 16–32) currently computes `javaOk`/`cppOk`. Add `cOk` and a third indicator:

```jsx
  const javaOk = isDrivableSignature('java', params, returnType);
  const cppOk = isDrivableSignature('cpp', params, returnType);
  const cOk = isDrivableSignature('c', params, returnType);
```

and in the JSX line that renders the driver indicators:

```jsx
      <div className="mt-0.5">
        Java driver: <span className={javaOk?'text-green-500':'text-red-500'}>{javaOk?'supported':'not supported'}</span>
        {'  ·  '}
        C++ driver: <span className={cppOk?'text-green-500':'text-red-500'}>{cppOk?'supported':'not supported'}</span>
        {'  ·  '}
        C driver: <span className={cOk?'text-green-500':'text-red-500'}>{cOk?'supported':'not supported'}</span>
      </div>
```

- [ ] **Step 4: Lint**

Run: `cd admin-client && npx eslint src/pages/ChallengeDetails.jsx src/pages/admin/QuestionSetsTab.jsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add admin-client/src/pages/ChallengeDetails.jsx admin-client/src/pages/admin/QuestionSetsTab.jsx
git commit -m "feat: admin editor language gating + C driver indicator in SignatureInfo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Full regression sweep

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything above.
- Produces: green build.

- [ ] **Step 1: Driver harness**

Run: `node shared/lib/verify-drivers.mjs`
Expected: `ALL PASS`, exit 0.

- [ ] **Step 2: Lints**

Run: `cd client && npm run lint` and `cd admin-client && npm run lint`
Expected: exit 0 in both (pre-existing warnings acceptable; no new errors).

- [ ] **Step 3: Server integration tests**

Run: `cd server && npm test`
Expected: `# pass 19` (or current total), `# fail 0`.

- [ ] **Step 4: Manual smoke (if dev server running)**

Open a Two Sum-style challenge in the participant app; confirm C appears enabled in the language dropdown, starter C code loads, and Run executes test cases with pass/fail results. Open a hypothetical non-drivable challenge (e.g. one with a `list<list<integer>>` param) and confirm C shows "— no runner" and is unselectable while Java/C++ remain enabled.
