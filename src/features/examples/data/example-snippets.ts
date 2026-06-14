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
    description: "FIFO macrotask queue ordering",
    language: "javascript",
    code: `console.log('script start');

setTimeout(function timeout1() {
  console.log('timeout 1');
}, 0);

setTimeout(function timeout2() {
  console.log('timeout 2');
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
    id: "typescript-greeting",
    title: "TypeScript Basics",
    category: "event-loop",
    description: "Typed snippet compiled before execution",
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
