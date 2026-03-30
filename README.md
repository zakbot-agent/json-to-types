# json-to-types

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)

> Convert JSON to TypeScript types and Zod schemas - CLI + web interface

## Features

- CLI tool
- TypeScript support

## Tech Stack

**Runtime:**
- TypeScript v5.9.3

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

```bash
cd json-to-types
npm install
```

Or install globally:

```bash
npm install -g json-to-types
```

## Usage

### CLI

```bash
json-to-types
```

### Available Scripts

| Script | Command |
|--------|---------|
| `npm run build` | `tsc` |
| `npm run start` | `node dist/index.js` |
| `npm run serve` | `node dist/index.js --serve` |
| `npm run dev` | `tsc --watch` |

## Project Structure

```
├── public
│   └── index.html
├── src
│   ├── converter.ts
│   ├── index.ts
│   ├── server.ts
│   ├── typescript.ts
│   └── zod.ts
├── package.json
├── README.md
└── tsconfig.json
```

## License

This project is licensed under the **MIT** license.

## Author

**Zakaria Kone**
