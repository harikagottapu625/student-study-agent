import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Finds the main topics of a document by spotting known syllabus terms, with
// fuzzy matching so OCR spelling errors ("Thheritance", "Exceplion") still
// count. Used when headings cannot be read, which is common with handwriting.

const PROGRAMMING_TOPICS = [
  ['Features of Java', ['features of java']],
  ['JDK, JRE and JVM', ['jdk', 'jre', 'jvm', 'java virtual machine', 'java development kit', 'runtime environment']],
  ['Variables', ['variable', 'variables']],
  ['Data Types', ['data type', 'data types', 'primitive']],
  ['Type Casting', ['type casting', 'typecasting']],
  ['Operators', ['operator', 'operators']],
  ['Keywords', ['keyword', 'keywords', 'reserved words']],
  ['Comments', ['comments']],
  ['Decision Making (if-else)', ['decision making', 'else if', 'if else']],
  ['Switch Statement', ['switch']],
  ['Loops', ['loop', 'loops', 'for loop', 'while loop', 'do while']],
  ['Break and Continue', ['continue statement', 'break statement']],
  ['Classes and Objects', ['objects and classes', 'classes and objects', 'class and object']],
  ['Methods', ['method', 'methods']],
  ['Constructors', ['constructor', 'constructors']],
  ['Static Keyword', ['static keyword', 'static']],
  ['this Keyword', ['this keyword']],
  ['super Keyword', ['super keyword']],
  ['Method Overloading', ['method overloading', 'overloading']],
  ['Method Overriding', ['method overriding', 'overriding']],
  ['Abstract Classes and Methods', ['abstract class', 'abstract method', 'abstract']],
  ['Interfaces', ['interface', 'interfaces']],
  ['Packages', ['package', 'packages']],
  ['Access Modifiers', ['access modifier', 'access modifiers']],
  ['Exception Handling', ['exception', 'exceptions', 'exception handling', 'try catch']],
  ['Multithreading', ['multithreading', 'thread', 'threads']],
  ['Arrays', ['array', 'arrays']],
  ['Strings', ['string', 'strings', 'stringbuilder']],
  ['Object Class', ['object class']],
  ['Math Class', ['math class']],
  ['Wrapper Classes', ['wrapper class', 'wrapper classes']],
  ['Collections', ['collection', 'collections', 'arraylist', 'hashmap', 'hashset']],
  ['File Handling', ['file handling', 'filereader', 'filewriter']],
  ['Garbage Collection', ['garbage collection', 'garbage collector']],
  ['Lambda Expressions', ['lambda']],
  ['Generics', ['generics']],
  ['Functions', ['function', 'functions']],
  ['Pointers', ['pointer', 'pointers']],
  ['Structures and Unions', ['union', 'unions', 'struct keyword', 'structure and union', 'structures and unions']],
  ['Lists, Tuples and Dictionaries', ['tuple', 'tuples', 'dictionary', 'dictionaries']],
  ['Modules', ['module', 'modules']],
  // Data structures and algorithms.
  ['Introduction to Data Structures', ['data structure', 'data structures', 'linear data structure', 'non linear data structure']],
  ['Abstract Data Type (ADT)', ['abstract data type', 'adt']],
  ['Linked List', ['linked list', 'singly linked', 'linked lists']],
  ['Doubly Linked List', ['doubly linked']],
  ['Circular Linked List', ['circular linked']],
  ['Stack', ['stack', 'stacks', 'push operation', 'pop operation']],
  ['Queue', ['queue', 'queues', 'enqueue', 'dequeue']],
  ['Circular Queue', ['circular queue']],
  ['Priority Queue', ['priority queue']],
  ['Infix, Prefix and Postfix', ['infix', 'postfix', 'prefix expression', 'polish notation']],
  ['Trees', ['tree', 'trees']],
  ['Binary Tree', ['binary tree', 'binary trees']],
  ['Binary Search Tree', ['binary search tree', 'bst']],
  ['Tree Traversal', ['inorder', 'preorder', 'postorder', 'tree traversal']],
  ['AVL Tree', ['avl tree', 'avl']],
  ['Heap', ['heap', 'heaps', 'max heap', 'min heap', 'heap sort']],
  ['Graphs', ['graph', 'graphs', 'adjacency matrix', 'adjacency list']],
  ['Graph Traversal (BFS and DFS)', ['breadth first', 'depth first', 'bfs', 'dfs']],
  ['Searching', ['linear search', 'binary search', 'searching']],
  ['Sorting', ['sorting', 'bubble sort', 'insertion sort', 'selection sort', 'quick sort', 'merge sort']],
  ['Hashing', ['hashing', 'hash table', 'hash function', 'collision']],
  ['Recursion', ['recursion', 'recursive']],
  ['Time and Space Complexity', ['time complexity', 'space complexity', 'big o', 'asymptotic']],
  ['Dynamic Memory Allocation', ['memory allocation', 'malloc', 'calloc', 'realloc']],
];

const KB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'knowledge');

const KB_TOPICS = (() => {
  try {
    return readdirSync(KB_DIR).filter((name) => name.endsWith('.json')).flatMap((file) => JSON.parse(readFileSync(path.join(KB_DIR, file), 'utf8')));
  } catch (error) {
    console.error('Topic lexicon: unable to read knowledge base files:', error.message);
    return [];
  }
})();

// The knowledge-base topic a spotted topic refers to, if any ("Stack" -> stack).
export const referenceTopic = (title) => {
  const name = title.toLowerCase();
  const singular = name.replace(/s$/, '');
  return KB_TOPICS.find((topic) => topic.title.toLowerCase() === name)
    || KB_TOPICS.find((topic) => topic.aliases.some((alias) => [name, singular].includes(alias.toLowerCase())))
    || null;
};

// Lexicon = programming topics above + every knowledge-base topic's aliases.
const buildLexicon = () => {
  const entries = PROGRAMMING_TOPICS.map(([name, terms]) => ({ name, terms }));
  for (const topic of KB_TOPICS) {
    // Short or single common words ("os", "index", "thread") are too ambiguous
    // to spot reliably; keep multi-word aliases and long distinctive words.
    const terms = topic.aliases
      .map((alias) => alias.toLowerCase())
      .filter((alias) => /^[a-z0-9 '-]+$/.test(alias) && (alias.includes(' ') ? alias.replace(/[^a-z]/g, '').length >= 6 : alias.length >= 8));
    if (terms.length) entries.push({ name: topic.title, terms });
  }
  return entries.map((entry) => ({ ...entry, termWords: entry.terms.map((term) => term.split(/[\s-]+/).filter(Boolean)) }));
};

const LEXICON = buildLexicon();

const distance = (left, right) => {
  if (left === right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = temp;
    }
  }
  return previous[right.length];
};

// Allowed OCR errors grow with word length; short words must match exactly.
const fuzzyEqual = (token, word) => {
  if (token === word) return true;
  if (word.length < 6 || Math.abs(token.length - word.length) > 2) return false;
  return distance(token, word) <= (word.length >= 9 ? 2 : 1);
};

const PAGE_MARKER = /^--\s*(\d+)\s+of\s+\d+\s*--$/;

// Finds every lexicon term mention in the text, line by line.
const matchTopics = (text) => {
  const lines = [];
  let page = 1;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      page = Number(marker[1]) + 1;
    } else if (line) {
      lines.push({ text: line, page, tokens: line.toLowerCase().match(/[a-z]+/g) || [] });
    }
  }

  // Fuzzy-match each lexicon word against each distinct token once; noisy OCR
  // repeats the same misspellings, so this keeps matching fast on long PDFs.
  const uniqueTokens = [...new Set(lines.flatMap((line) => line.tokens))];
  const lexiconWords = [...new Set(LEXICON.flatMap((entry) => entry.termWords.flat()))];
  const matchesFor = new Map(lexiconWords.map((word) => [word, new Set(uniqueTokens.filter((token) => fuzzyEqual(token, word)))]));

  const found = new Map();
  lines.forEach((line, lineIndex) => {
    // Each topic's first matching term on this line, with the tokens it covers.
    const hits = [];
    for (const entry of LEXICON) {
      for (const words of entry.termWords) {
        let at = -1;
        for (let start = 0; start + words.length <= line.tokens.length && at < 0; start += 1) {
          if (words.every((word, offset) => matchesFor.get(word).has(line.tokens[start + offset]))) at = start;
        }
        if (at < 0) continue;
        hits.push({ entry, length: words.length, from: at, to: at + words.length });
        break;
      }
    }
    // A longer phrase claims its words: "data structure" is not a mention of
    // "Structures", nor "abstract data type" of "Abstract Classes".
    const kept = hits.filter((hit) => !hits.some((other) => other.length > hit.length && other.from <= hit.from && other.to >= hit.to));
    for (const { entry, length } of kept) {
      const record = found.get(entry.name) || { name: entry.name, count: 0, lines: new Set(), pages: new Map(), weight: 0, phraseHits: 0 };
      record.count += 1;
      record.weight += length;
      if (length > 1) record.phraseHits += 1;
      record.lines.add(lineIndex);
      record.pages.set(line.page, (record.pages.get(line.page) || 0) + 1);
      found.set(entry.name, record);
    }
  });
  return { lines, found };
};

// Lines that mention a known topic term, even misspelled ("Thheritance").
export const topicTermLines = (text) => {
  const { lines, found } = matchTopics(text);
  return new Set([...found.values()].flatMap((record) => [...record.lines].map((index) => lines[index].text)));
};

export const spotTopics = (text, { maxTopics = 30 } = {}) => {
  const { lines, found } = matchTopics(text);

  // A topic needs one specific multi-word mention ("wrapper class") or repeated
  // single-word mentions; long documents need more, since stray words add up.
  const pageCount = lines.length ? lines[lines.length - 1].page : 1;
  const minMentions = Math.max(3, Math.ceil(pageCount / 20));
  const candidates = [...found.values()]
    .filter((record) => record.phraseHits >= 1 || record.count >= minMentions)
    .sort((left, right) => right.weight - left.weight);

  // Drop topics spotted on the same lines as a stronger topic (e.g. "Process vs
  // Thread" riding on "Multithreading" mentions).
  // Also drop a second name for the same concept ("Sorting" vs "Sorting Algorithms").
  const kept = [];
  for (const record of candidates) {
    const reference = referenceTopic(record.name)?.id;
    const duplicate = kept.some((other) => {
      if (reference && referenceTopic(other.name)?.id === reference) return true;
      const shared = [...record.lines].filter((index) => other.lines.has(index)).length;
      return shared / record.lines.size >= 0.7;
    });
    if (!duplicate) kept.push(record);
    if (kept.length >= maxTopics) break;
  }

  // The topic's page is where it is discussed most, not its first mention
  // (which is often a contents page).
  return kept
    .map((record) => {
      const [page] = [...record.pages.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0];
      return { title: record.name, page, mentions: record.count, lines: [...record.lines].map((index) => lines[index].text) };
    })
    .sort((left, right) => left.page - right.page);
};
