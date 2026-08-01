# Java & C++ LeetCode Drivers — Design

**Date:** 2026-07-09
**Status:** Approved, pending implementation plan

## Goal

Extend the LeetCode-style function driver (currently Python + JavaScript only, in
`client/src/lib/leetcodeDriver.js` and its `admin-client` twin) to **Java** and **C++**,
so that function-only challenge solutions in those languages can be auto-wrapped and run
against test cases via Judge0 — the same experience Python/JS users already have.

## The core constraint

Python and JS work with **zero type information**: the driver parses each stdin line as
JSON and calls `fn(*args)`. Dynamic typing resolves everything at runtime.

Java and C++ are statically typed. To call `twoSum(int[] nums, int target)` the generated
driver must know each parameter's type (to declare a typed variable and parse JSON into it)
and the return type (to serialize the result). There is no `fn(*args)` equivalent.

Today a challenge stores **only `functionName`** (`Challenge.model.js:28`). The parameter
and return types exist at LeetCode import time (`metaData.params[].type` and
`metaData.return.type`, parsed in `leetcode.service.js:118`) but are **discarded**.

## Decisions

- **Type source: persist LeetCode's metadata (approach A).** Save `params` and
  `returnType` onto the Challenge, thread them to the client, and generate typed drivers.
  This is the only robust option and the type data already flows through the import path.
- **Coverage: Tier 1 + Tier 2.** Scalars, 1D arrays/lists, and nested (2D) arrays/lists.
  `ListNode`/`TreeNode`/`void` and anything unrecognized are out of scope → fallback.
- **Output format is forgiving.** `normalizeOutput` (`ChallengeDetails.jsx:75`) strips all
  whitespace and normalizes quotes/booleans before comparison, so drivers only need
  structurally-correct compact JSON (`[1,2,3]`, `true`, `"abc"`) — spacing is irrelevant.

## Architecture

### 1. Persist the types

`Challenge.model.js` gains, alongside `functionName`:

```js
params: [{ name: String, type: String, _id: false }],  // e.g. { name:"nums", type:"integer[]" }
returnType: { type: String, default: '' },              // e.g. "integer[]"
```

`leetcode.service.js` already parses `meta.params` and `meta.name` (lines 118–120). It
additionally captures `returnType: meta.return?.type` and returns `params` (instead of only
using it to split test cases). The challenge controller / serializer includes both fields in
the challenge payload sent to the client.

**Backward compatibility:** existing challenges and manually-created (non-LeetCode)
challenges have no `params`/`returnType` → Java/C++ fall back to today's manual-stdin
behavior. Python/JS are unaffected. Re-importing from LeetCode populates the fields.

### 2. Client gating — `leetcodeDriver.js`

New predicate:

```js
isDrivableSignature(language, params, returnType)
// true only if every param type AND returnType is within Tier 1+2
```

`wrapWithDriver` signature extends to `(code, language, functionName, params, returnType)`.
Unknown/unsupported types → returns the raw code (current fallback).

`ChallengeDetails.jsx` (both `client` and `admin-client` copies) updates the gate:

```js
const isSupportedDriver =
  language === "python" || language === "javascript"
  || ((language === "java" || language === "cpp")
      && isDrivableSignature(language, params, returnType));
```

stdin is unchanged: `argsToJsonStdin` (one JSON value per line) already serves all four
languages.

### 3. Generators

Both consume the same JSON-per-line stdin and emit compact JSON to stdout. Both wrap
execution in try/catch → print stack/error to stderr and `exit(1)`, mirroring the Python
driver.

- **Java** (Judge0 id 62, OpenJDK 13, no JSON library): inject a small recursive-descent
  JSON parser producing a generic `Object` tree (`ArrayList<Object>`, `Long`, `Double`,
  `Boolean`, `String`, `null`). Type-directed converters map the generic tree to the
  declared types (`"integer[]"` → `int[]`, `"list<list<integer>>"` → `List<List<Integer>>`,
  …). The method is located via reflection (`Solution` instance method, else a static
  method matching name + arg count), invoked, and the result serialized by branching on its
  runtime type.

- **C++** (Judge0 id 54, GCC, no JSON library): no reflection, so the generator threads the
  persisted type strings into codegen — declares typed variables
  (`vector<vector<int>> arg0; parseIntMatrix(line0, arg0);`), calls
  `Solution().functionName(arg0, arg1, …)`, and serializes via type-specific `toJson`
  helpers. Same embedded minimal JSON tokenizer.

### 4. Type map (Tier 1 + 2)

Base types: `integer`, `long`, `double`, `boolean`, `string`, `character`.
Variants: `T`, `T[]`, `T[][]`, `list<T>`, `list<list<T>>`.

LeetCode type strings are lowercase (`"integer[]"`, `"list<integer>"`), so a single
normalize + lookup table drives both generators. Anything not in the table
(`ListNode`, `TreeNode`, `void`, etc.) → not drivable → fallback.

| LeetCode type        | Java              | C++                     |
|----------------------|-------------------|-------------------------|
| `integer`            | `int`             | `int`                   |
| `long`               | `long`            | `long long`             |
| `double`             | `double`          | `double`                |
| `boolean`            | `boolean`         | `bool`                  |
| `string`             | `String`          | `string`                |
| `character`          | `char`            | `char`                  |
| `integer[]`          | `int[]`           | `vector<int>`           |
| `string[]`           | `String[]`        | `vector<string>`        |
| `integer[][]`        | `int[][]`         | `vector<vector<int>>`   |
| `character[][]`      | `char[][]`        | `vector<vector<char>>`  |
| `list<integer>`      | `List<Integer>`   | `vector<int>`           |
| `list<list<integer>>`| `List<List<Integer>>` | `vector<vector<int>>` |

(…and the analogous `list<string>`, `double[]`, `boolean[]`, `string[][]`, etc.)

## Known limitations (documented, not solved now)

- Manually-created challenges without imported metadata get no Java/C++ driver (fallback to
  manual stdin).
- `void` in-place-mutation problems (rotate, moveZeroes) are a Tier-3 follow-up.
- The two `leetcodeDriver.js` copies (`client` + `admin-client`) must stay byte-identical.
  Both are updated together; the duplication is pre-existing and out of scope to fix here.

## Testing

- Server: unit-test that `leetcode.service` returns `params` + `returnType`, and that the
  challenge payload/serializer carries them through.
- Driver generators: unit-test `wrapWithDriver` for Java and C++ across representative
  signatures (scalar in/out, `int[]`, `int[][]`, `String[]`, `List<List<Integer>>`),
  asserting the generated source compiles-and-runs shape (snapshot / structural assertions)
  and that `isDrivableSignature` correctly accepts Tier 1+2 and rejects Tier 3.
- Manual end-to-end: import a known LeetCode problem (e.g. Two Sum), run a Java and a C++
  solution through the Judge0 batch path, confirm pass/fail matches expected.
