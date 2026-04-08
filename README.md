# @chocbite/ts-lib-state

A type-safe state management library for TypeScript with support for synchronous/asynchronous, read-only/writable, and result-based states.

## Installation

```bash
npm install @chocbite/ts-lib-state
```

## Overview

The library classifies states along three axes:

- **Sync** — Synchronous (`ROS`, `RES`) or Asynchronous (`ROA`, `REA`)
- **Error** — Always OK (`ROS`, `ROA`) or Error-capable (`RES`, `REA`)
- **Write** — Read-only or Writable (`ROSW`, `ROAW`, `RESW`, `REAW`)

This gives eight state types that cover every combination:

| Type   | Sync | OK-only | Writable |
| ------ | ---- | ------- | -------- |
| `ROS`  | ✓    | ✓       |          |
| `ROSW` | ✓    | ✓       | ✓        |
| `RES`  | ✓    |         |          |
| `RESW` | ✓    |         | ✓        |
| `ROA`  |      | ✓       |          |
| `ROAW` |      | ✓       | ✓        |
| `REA`  |      |         |          |
| `REAW` |      |         | ✓        |

## Quick Start

```typescript
import state from "@chocbite/ts-lib-state";
import { ok } from "@chocbite/ts-lib-result";

// Create a writable, sync, ok-only state
const counter = state.ok_w(0);

// Subscribe to changes (true = call immediately with current value)
counter.sub((result) => {
  console.log("Count:", result.value);
}, true);

// Owner change state value
counter.set(ok(1));

// User request change to state value
counter.write(ok(2));

// Read the current value synchronously
console.log(counter.ok()); // 2
console.log(counter.get()); // ResultOk<2>

// Read the current value asynchronously
console.log(await counter); // ResultOk<2>
```

## State Methods

Every state has a common set of methods. The specific state type determines which additional methods are available and how return types are narrowed — all enforced at compile time by TypeScript.

### Common Methods

Available on every state type:

| Method                           | Description                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `await state` / `state.then(fn)` | Get the current value. Returns `ResultOk<T>` on ok-only types, `Result<T, string>` on error-capable types. |
| `sub(fn, immediate?)`            | Subscribe to value changes. Pass `true` to also call `fn` immediately with the current value.              |
| `unsub(fn)`                      | Remove a subscription.                                                                                     |
| `related()`                      | Returns helper metadata (e.g., number min/max, string max_length).                                         |
| `in_use()`                       | Returns the state if it has any subscribers, `undefined` otherwise.                                        |
| `has(fn)`                        | Returns the state if `fn` is a current subscriber.                                                         |
| `amount()`                       | Returns the subscriber count.                                                                              |

### Narrowed Methods

These methods are only guaranteed on certain state types. TypeScript will error if you call them on the wrong type:

| Method         | Available when               | Description                                      |
| -------------- | ---------------------------- | ------------------------------------------------ |
| `get()`        | Sync (`rsync: true`)         | Synchronously read the current `Result` value.   |
| `ok()`         | Sync + OK-only (`rok: true`) | Synchronously read the unwrapped value directly. |
| `write(value)` | Writable (`writable: true`)  | Request a value change for the state.            |
| `limit(value)` | Writable                     | Clamp a value to the valid range via the helper. |
| `check(value)` | Writable                     | Validate a value without applying it.            |

### Per-Type Narrowing

Each of the eight state types narrows the available methods and result types:

| Type        | `get()`       | `ok()` | `write()/ limit()/ check()` | `then` / `await` result |
| ----------- | ------------- | ------ | --------------------------- | ----------------------- |
| `StateROS`  | `ResultOk<T>` | `T`    | —                           | `ResultOk<T>`           |
| `StateROSW` | `ResultOk<T>` | `T`    | ✓                           | `ResultOk<T>`           |
| `StateRES`  | `Result<T>`   | —      | —                           | `Result<T>`             |
| `StateRESW` | `Result<T>`   | —      | ✓                           | `Result<T>`             |
| `StateROA`  | —             | —      | —                           | `ResultOk<T>`           |
| `StateROAW` | —             | —      | ✓                           | `ResultOk<T>`           |
| `StateREA`  | —             | —      | —                           | `Result<T>`             |
| `StateREAW` | —             | —      | ✓                           | `Result<T>`             |

The three boolean properties `rsync`, `rok`, and `writable` act as runtime discriminants matching the same axes:

- **Sync** (`rsync: true`) — enables `get()`, and `ok()` when also ok-only
- **OK-only** (`rok: true`) — narrows `then` result to `ResultOk<T>` (value is never an error)
- **Writable** (`writable: true`) — enables `write()`, `limit()`, and `check()`

The types form a subtype hierarchy — more specific types are assignable to less specific ones. For example, a `StateROSW<number>` (sync + ok + writable) can be passed anywhere a `StateROS<number>`, `StateROA<number>`, or `State<number>` is expected.

```typescript
function show_sync(s: StateROS<number>) {
  // Sync + OK → get() and ok() available
  console.log(s.ok()); // number — unwrapped value
  console.log(s.get().value); // number — via ResultOk
}

async function show_async(s: StateROA<number>) {
  // Async + OK → no get()/ok(), must await
  const result = await s; // ResultOk<number>
  console.log(result.value); // always ok, no error check needed
}

function handle_errors(s: StateRES<number>) {
  // Sync + Error-capable → get() returns Result<T, string>
  const result = s.get();
  if (result.ok) console.log(result.value);
  else console.log(result.error);
}

async function update(s: StateROSW<number>) {
  // Writable → write(), limit(), check() available
  s.write(42);
  // This will only be correct if the state accepts the write
  console.log(s.ok()); // 42
  // If the write is denied it should return a Result<void,string> with the reason for denying the write as a string
  console.log(await s.write(42));
}
```

Each state type can be narrowed down to a less restricted state type with StateROS being the least restricted and State/StateREA being the most restricted.

```typescript
async function narrowing(s: State<number>) {
  if (s.ok) {
    //State -> StateROXX
    if (s.sync) {
      //StateROXX -> StateROSX
      if (s.writable) {
        //StateROSX -> StateROSW
      }
    }
  }
}
```

## Creating States

### Shorthand state generators

```typescript
state.ok(value); // ROS  — read-only, sync, always ok
state.ok_w(value); // ROSW — writable, sync, always ok
state.from(value); // RES  — read-only, sync, error-capable
state.from_w(value); // RESW — writable, sync, error-capable
state.err(message); // RES  — read-only, sync, starts with error
state.err_w(message); // RESW — writable, sync, starts with error
```

### Local States

For full control over initial values, use the lower-level local factories. Each accepts a `Result` value:

```typescript
import { ok, err } from "@chocbite/ts-lib-result";

const a = state.ros(ok(42)); // ROS
const b = state.rosw(ok(42)); // ROSW
const c = state.res(ok(42)); // RES
const d = state.resw(err("n/a")); // RESW
```

State generators also accept a function which will be lazily executed at first access of state value:

```typescript
import { ok } from "@chocbite/ts-lib-result";
const f = state.ros(() => ok(42)); // ROS
```

Async local states accept an async function, which is lazily executed at first state access:

```typescript
const e = state.roa(async () => ok(await fetchData()));
const f = state.roaw(async () => ok(await fetchData()));
```

#### Owner

Every local generator returns an **owner** — the full state object that includes both the public state interface and privileged methods for updating it. The owner is what you keep internally; you hand out `state.read_only` or `state.read_write` to consumers.

```typescript
const counter = state.rosw(ok(0));

// Owner methods
counter.set(ok(5)); // set the raw Result value
counter.set_ok(5); // shorthand: wraps the value in ok() for you
counter.set_err("fail"); // set an error (only on error-capable states: RES/REA)

// The owner can get basic state types without access to the owner methods for passing on, or just set them to a variable with appropriate typeing
const read_only = counter.read_only; //Returns as StateROS<number>
const read_only_type: StateROS<number> = counter;
const read_write = counter.read_write; // Returns as StateROSW<number>
const read_write_type: StateROSW<number> = counter;
const state = counter.state; // Returns as State<number>
const state_type: State<number> = counter.state;
```

`set` and `set_ok` bypass the setter/validation pipeline — they directly replace the state value and notify subscribers. In contrast, `.write()` is the public API that goes through the setter function (which may apply helpers like `limit`).

You can also provide a custom setter to control how writes are applied:

```typescript
const limited = state.rosw(ok(0), async (value, owner, old) => {
  // Custom write logic
  if (Number.isNaN(value)) return err("NaN is not allowed");
  owner.set_ok(Math.min(100, Math.max(0, value)));
  return ok(undefined);
});
```

## Subscribing to State

```typescript
// Subscribe — callback receives a Result<T, string>
const unsub = counter.sub((result) => {
  if (result.ok) {
    console.log(result.value);
  }
});

// Unsubscribe
counter.unsub(unsub);

// Subscribe with immediate invocation
counter.sub(callback, true);

// Promise-style using then executes immediately
counter.then((result) => {
  console.log(result.value);
});
// Promise-style using await syntax executes in microloop
console.log((await counter).value);
```

## Collected States

Combine multiple states into a single derived state:
Combination function is evaluated as a promise/microtask, so if you change first_name and last_name in the same cycle, it will only be called once.

```typescript
const first_name = state.ok("Alice");
const last_name = state.ok("Smith");

const full_name = state.c.ros(
  (vals) => ok(`${vals[0].value} ${vals[1].value}`),
  first_name,
  last_name,
);
// full_name.ok() === "Alice Smith"
```

Available variants: `state.c.ros`, `state.c.roa`, `state.c.res`, `state.c.rea`.

## Proxy States

Wrap a state with read/write transformation functions or proxy its value:

```typescript
const source = state.ok_w(5);

// Read-only proxy that doubles the value
const doubled = state.p.ros(source, (val) => ok(val.value * 2));
// doubled.ok() === 10

// Writable proxy
// A proxy can also be writable, but this requires two transform functions to convert both ways, this is to support the write helper methods limit and check
const offset = state.p.rosw(
  source,
  (val) => ok(val.value + 10), // read: add 10
  {
    wout_win: (val) => ok(val.value - 10), // write→inner: subtract 10
    win_wout: (val) => ok(val.value + 10), // inner→write: add 10
  },
);
```

## Remote States

Remote states represent asynchronous resources that are fetched on demand or streamed via a subscription. They are always async (`ROA`/`REA`/`ROAW`/`REAW`).

Each remote generator (`state.r.*.from`) takes three callback functions and an optional timing configuration:

- **`once`** — called when the state value is awaited (one-shot fetch). Call `owner.update_single(value)` to deliver the result.
- **`setup`** — called when the first subscriber arrives. Use this to open a connection or start polling. Call `owner.update_value(value)` to push new values.
- **`teardown`** — called when the last subscriber leaves. Clean up connections here.

```typescript
let ws;
const user_data = state.r.roa.from<User>(
  // once: one-shot fetch when awaited
  async (owner) => {
    const data = await fetch("/api/user").then((r) => r.json());
    owner.update_single(ok(data));
  },
  // setup: called on first subscription
  (owner) => {
    const ws = new WebSocket("/api/user_subscribe");
    ws.onmessage = (e) => owner.update_value(ok(JSON.parse(e.data)));
  },
  // teardown: called when all subscribers leave
  () => {
    ws.close();
  },
);
```

Timing options control debounce, validity caching, and retention:

```typescript
state.r.rea.from(once, setup, teardown, {
  timeout: 1000, // ms before a generic error if no response
  debounce: 50, // ms to batch multiple awaits into one fetch
  validity: 5000, // ms the buffered value stays fresh (or true = until unsubscribe)
  retention: 200, // ms to keep the connection after last unsubscribe
});
```

Writable remote variants (`state.r.roaw`, `state.r.reaw`) additionally accept a `write_action` callback:

```typescript
const setting = state.r.roaw.from<number>(
  once,
  setup,
  teardown,
  async (value, owner) => {
    await fetch("/api/setting", {
      method: "POST",
      body: JSON.stringify(value),
    });
    return ok(undefined);
  },
  { write_debounce: 300 }, // ms to wait before using the last value written
);
```

Available variants: `state.r.roa`, `state.r.rea`, `state.r.roaw`, `state.r.reaw`.

## Helpers

### Array

States holding arrays get built-in mutation helpers:

```typescript
const list = state.rosw(ok([1, 2, 3]));

list.array.push(4); // [1, 2, 3, 4]
list.array.unshift(0); // [0, 1, 2, 3, 4]
list.array.pop(); // [0, 1, 2, 3]
list.array.shift(); // [1, 2, 3]
list.array.insert(1, [99]); // [1, 99, 2, 3]
list.array.remove(0, 1); // [99, 2, 3]
list.array.change(0, 50); // [50, 2, 3]
```

Each mutation is tracked with metadata (`added`, `removed`, `changed`, `fresh`).

### Object

States holding objects get field-level mutation helpers:

```typescript
const obj = state.rosw(ok({ a: 1, b: 2 }));

obj.object.set({ a: 10 }); // { a: 10, b: 2 }
obj.object.remove("b"); // { a: 10 }
```

Each mutation is tracked with metadata (`added`, `removed`, `changed`, `fresh`).

### Number

```typescript
const temperature = state.rosw(
  state.n.help(ok(20), {
    min: state.ok(0),
    max: state.ok(100),
    step: state.ok(0.5),
  }),
  true,
);

await temperature.write(150); // limited to 100 by the helper
await temperature.check(150); // returns err("150 is bigger than the limit of 100")
temperature.related().unwrap().min; // state holding 0
```

Options: `min`, `max`, `step`, `start`, `decimals`, `unit` — each is itself a `State`, so limits can be reactive.

### String

```typescript
const name = state.rosw(
  state.s.help(ok("hello"), {
    max_length: state.ok(10),
    max_bytes: state.ok(10),
  }),
  true,
);

await name.write("this is too long"); // limited to 10 characters by the helper
await name.check("this is too long"); // returns err("the text is longer than the limit of 10 characters")
await name.write("this is ææ"); // limited to 10 bytes by the helper
await name.check("this is ææ"); // returns err("the text is longer than the limit of 10 bytes")
```

Options: `max_length`, `max_length_bytes`.

### Enum

```typescript
export const Color = {
  Red: "red",
  Green: "green",
  Blue: "blue",
} as const;
export type Color = (typeof Color)[keyof typeof Color];

const list = state.e.list<Color>({
  [Color.Red]: { name: "Red" },
  [Color.Green]: {
    name: "Green",
    description: "The color green, what more is needed",
  },
  [Color.Blue]: {
    name: "Blue",
    description: "I'm blue dabudedabuda",
    icon: () => blue_icon.cloneNode(),
  },
});

const color = state.rosw(
  state.e.help(ok(Color.Red as Color), { list: state.ok(list) }),
  true,
);
```

### Boolean

```typescript
const flag = state.rosw(state.b.help(ok(true)), true);
```

## Type Guards

Check state types at runtime:

```typescript
state.is.state(obj); // Is any state?
state.is.ros(obj); // Is ROS?
state.is.rosw(obj); // Is ROSW?
state.is.res(obj); // Is RES?
// ... and so on for all eight types
```

## Utilities

```typescript
// Await the first emitted value from any state
const value = await state.u.await_value(myState);

// Compare any two state values for equality, returns a promise
const equal = state.u.compare(stateA, stateB);

// Compare two states sync state values
const equal = state.u.compare_sync(stateA, stateB);
```

## License

MIT
