# C Driver + Language Gating: LeetCode-Style Execution for All Supported Languages

**Date:** 2026-07-14
**Status:** Approved
**Scope:** Option A — every language in the editor dropdown (JavaScript, Python, Java, C++, C) executes function-style for the currently supported type tier. Structural types (ListNode/TreeNode) are a follow-up (Option B).

## Problem

The challenge editor offers 5 languages, but driver coverage is uneven:

| Language | Driver today | Unsupported-signature behavior |
|---|---|---|
| Python | always wrapped | n/a (dynamic) |
| JavaScript | always wrapped | n/a (dynamic) |
| Java | scalars/arrays/lists depth ≤ 2, + void | raw code → `ClassNotFoundException: Main` on Judge0 |
| C++ | same as Java | raw code → linker error (no `main`) |
| C | **no driver at all** | raw code → always fails, even Two Sum |

Any participant who picks C hits a guaranteed runtime error. Participants can also pick Java/C++ on challenges whose signature isn't drivable and hit the same crash class.

## Design

### 1. Type tier (`isDrivableSignature` in `shared/lib/leetcodeDriver.js`)

- `"c"` joins `"java"`/`"cpp"` as a drivable language.
- Language-aware depth cap: C requires every param and the return type to be a supported base (`integer`, `long`, `double`, `boolean`, `string`, `character`) at **depth ≤ 1**; Java/C++ keep depth ≤ 2. `void` returns allowed for all three.
- `isSupportedType` gains a `maxDepth` parameter (default 2). No other behavior changes.

### 2. C codegen (`buildCDriver(code, functionName, params, returnType)`)

Mirrors `buildCppDriver`'s structure: a fixed helper block (string constant) plus a generated `main`. The driver synthesizes LeetCode's C calling convention from stored metadata:

**Param mapping** (metadata type → generated C params):

| Metadata | Generated |
|---|---|
| `integer` | `int argN` |
| `long` | `long long argN` |
| `double` | `double argN` |
| `boolean` | `bool argN` |
| `character` | `char argN` |
| `string` | `char* argN` |
| scalar `T[]` (e.g. `integer[]`) | `T* argN, int argNSize` |
| `character[]` | `char* argN, int argNSize` |
| `string[]` | `char** argN, int argNSize` |

**Return mapping:**

- Scalars and `string`: returned directly, printed as JSON.
- Array returns (`T[]`, `string[]`): the call appends a final `int* returnSize` out-param (LeetCode convention); the driver prints `returnSize` elements.
- `void` (in-place problems): the driver calls the function, then prints the **mutated first argument** using its original parsed size — same convention already shipped for Java/C++/Python/JS.

**Helper block** (plain C; `stdio.h`, `stdlib.h`, `string.h`, `stdbool.h`, `ctype.h`):

- Line-based JSON parsing: numbers, strings with escapes, bools, flat arrays. Depth ≤ 1 means no recursive array parsing is needed.
- JSON serializers for each scalar kind, strings (escaped), and arrays.
- Parse/driver errors: message to `stderr`, `exit(1)` — parity with the other drivers.
- User code is emitted **after** the driver's includes so `malloc` etc. are always in scope (the scraper may or may not have added includes to the snippet). Returned buffers are not freed; the process exits immediately.

### 3. Wiring (`wrapWithDriver`)

Add the `language === "c" && isDrivableSignature(...)` branch calling `buildCDriver`. The run path in both `client/src/pages/ChallengeDetails.jsx` and `admin-client/src/pages/ChallengeDetails.jsx` already routes stdin encoding and wrapping through `isDrivableSignature`, so C activates automatically. Judge0 language id 50 (C, GCC) is already mapped in `constants/languages.js`.

### 4. Dropdown gating (airtight guarantee)

In both apps' challenge editors:

- When a challenge has a `functionName`, compiled-language options (`java`, `cpp`, `c`) whose signature is **not** drivable render disabled with a hint ("runner unavailable for this language").
- Python/JavaScript are always enabled.
- Challenges without `functionName` (manual-stdin challenges) are never gated.
- If the currently selected language becomes disabled (e.g. deep link), the editor falls back to the first enabled language.

Admin `SignatureInfo` (QuestionSetsTab) adds a `C driver: supported / not supported` indicator beside the existing Java/C++ ones.

### 5. Verification

One-off local harness (same method used to verify the void-return fix), compiled with local `gcc`/`javac`:

- **C:** twoSum (`int[] + int → int[]`, exercises `returnSize`), reverseString (`char[]`, void), moveZeroes (`int[]`, void), a `string → boolean` case, longestCommonPrefix (`string[] → string`).
- **Regression:** re-run the Java/C++/Python/JS harness cases (void + non-void) to prove no behavior change.
- Lint in `client/` and `admin-client/`; server integration tests (`cd server && npm test`) still pass.

## Out of Scope (deferred to Option B)

- ListNode / TreeNode structural types (all languages).
- 2-D arrays in C (`int** returnColumnSizes` convention).
- `void` problems that mutate a non-first parameter.
