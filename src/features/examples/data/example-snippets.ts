import type { ExampleSnippet } from "@/types/execution";

/** Curated learning snippets inspired by JS Visualizer 9000 and common interview patterns. */
export const EXAMPLE_SNIPPETS: ExampleSnippet[] = [
  {
    id: "event-loop-classic",
    title: "Event Loop Classic",
    category: "event-loop",
    description: "setTimeout vs Promise.then execution order",
    language: "javascript",
    code: `function logA() { console.log('A'); }
function logB() { console.log('B'); }
function logC() { console.log('C'); }
function logD() { console.log('D'); }

logA();
setTimeout(logB, 0);
Promise.resolve().then(logC);
logD();`,
  },
  {
    id: "microtask-chain",
    title: "Microtask Chain",
    category: "promises",
    description: "Multiple Promise.then callbacks drain before macrotasks",
    language: "javascript",
    code: `console.log('start');

Promise.resolve()
  .then(function first() { console.log('micro 1'); })
  .then(function second() { console.log('micro 2'); });

setTimeout(function macro() { console.log('macro 1'); }, 0);

console.log('end');`,
  },
  {
    id: "nested-timeouts",
    title: "Nested Timeouts",
    category: "event-loop",
    description: "Inner timeout scheduled from outer callback runs in a later macrotask turn",
    language: "javascript",
    code: `console.log('script start');

setTimeout(function timeout1() {
  console.log('timeout 1');

  setTimeout(function timeout2() {
    console.log('timeout 2');
  }, 0);
}, 0);

console.log('script end');`,
  },
  {
    id: "promise-then-chain",
    title: "Promise.then Chain",
    category: "promises",
    description: "Chained microtasks resolve in order",
    language: "javascript",
    code: `console.log('1');

Promise.resolve('2')
  .then(function stepA(value) {
    console.log(value);
    return '3';
  })
  .then(function stepB(value) {
    console.log(value);
  });

console.log('4');`,
  },
  {
    id: "new-promise-settimeout",
    title: "new Promise + setTimeout",
    category: "promises",
    description:
      "Executor runs synchronously; .then handler queues immediately, runs after setTimeout resolves the promise",
    language: "javascript",
    code: `console.log('start');

const delayed = new Promise(function resolveLater(resolve) {
  console.log('executor');
  setTimeout(function onTimeout() {
    resolve('done');
  }, 0);
});

delayed.then(function onResolved(value) {
  console.log(value);
});

console.log('end');`,
  },
  {
    id: "promise-rejection-catch",
    title: "Promise Rejection + .catch",
    category: "promises",
    description: "Rejected promises handled by .catch in the microtask queue",
    language: "javascript",
    code: `console.log('start');

Promise.reject(new Error('boom'))
  .catch(function handleError(err) {
    console.log(err.message);
  })
  .finally(function cleanup() {
    console.log('finally');
  });

console.log('end');`,
  },
  {
    id: "async-await-basic",
    title: "async/await Basics",
    category: "async-await",
    description: "Async function pauses at await, then resumes on the microtask queue",
    language: "javascript",
    code: `async function handle() {
  const x = await Promise.resolve(1);
  console.log(x);
}

console.log('start');
handle();
console.log('end');`,
  },
  {
    id: "async-sequential-await",
    title: "Sequential await",
    category: "async-await",
    description: "Two awaits in one async function suspend and resume in order",
    language: "javascript",
    code: `async function load() {
  const first = await Promise.resolve('first');
  console.log(first);
  const second = await Promise.resolve('second');
  console.log(second);
}

load();`,
  },
  {
    id: "async-iife",
    title: "async IIFE",
    category: "async-await",
    description: "Immediately invoked async function expression",
    language: "javascript",
    code: `console.log('before');

(async function runner() {
  const value = await Promise.resolve('inside IIFE');
  console.log(value);
})();

console.log('after');`,
  },
  {
    id: "async-p1-p2",
    title: "Delayed Promises + await",
    category: "async-await",
    description: "Two delayed Promises awaited in order — virtual clock shows 5s and 7s timer steps",
    language: "javascript",
    code: `const p1 = new Promise((resolve) => {
  setTimeout(() => resolve('p1 resolved'), 5000);
});
const p2 = new Promise((resolve) => {
  setTimeout(() => resolve('p2 resolved'), 7000);
});

async function handlep2() {
  const val = await p1;
  console.log(val);
  const val2 = await p2;
  console.log(val2);
}

handlep2();`,
  },
  {
    id: "async-rejection",
    title: "await Rejection",
    category: "async-await",
    description: "Rejected await surfaces as a runtime error",
    language: "javascript",
    code: `async function fail() {
  await Promise.reject(new Error('await failed'));
}

fail();`,
  },
  {
    id: "typescript-greeting",
    title: "TypeScript Basics",
    category: "promises",
    description: "TypeScript compiles to JS; sync log then a Promise microtask",
    language: "typescript",
    code: `type Message = { text: string };

const message: Message = { text: 'Hello from TypeScript' };

function logMessage(value: Message): void {
  console.log(value.text);
}

logMessage(message);

Promise.resolve().then(() => console.log('typed microtask'));`,
  },
];
