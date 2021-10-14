# RIF Relay Client

This typescript repository contains all the client code used by the RIF Relay System.

This project works as a dependency and needs to be installed in order to be used.

## Table of Contents

- [**Installation**](#installation)
  - [**Pre-requisites**](#pre-requisites)
  - [**Dependencies**](#dependencies)
- [**Usage**](#usage)
  - [**Use a release version**](#use-a-release-version)
  - [**Use the repo distributable**](#use-the-repo-distributable)
  - [**Use a local distributable**](#use-a-local-distributable)
- [**Development**](#development)
  - [**Enabling postinstall scripts**](#enabling-postinstall-scripts)
  - [**Husky and linters**](#husky-and-linters)
  - [**Generating a new distributable version**](#generating-a-new-distributable-version)
    - [**For GitHub**](#for-github) 
    - [**For NPM**](#for-npm)
    - [**For direct use (no publishing)**](#for-direct-use-no-publishing)

## Installation

### Pre-requisites

- Node version 12.18

### Dependencies

To start working with this project you need to first enable `postinstall` scripts (refer to section [Enabling postinstall scripts](#enabling-postinstall-scripts)).

Then just run `npm install` to install all dependencies.

## Usage

You can use this dependency once you have it installed on your project. There are multiple ways to do this:

### Use a release version 

Install with:
```bash
npm i --save @rsksmart/rif-relay-client
```

### Use the repo distributable

Modify your `package.json` file to add the following line:

``` 
"@rsksmart/rif-relay-client": "https://github.com/infuy/rif-relay-client",
```

### Use a local distributable

Clone this repository inside your project's root folder, and modify your `package.json` file to add the following line: 

```
"@rsksmart/rif-relay-client": "../rif-relay-client",
```

## Development

If you need to modify resources inside this repository: 
- make sure that [`postinstall` scripts are enabled](#enabling-postinstall-scripts) in the `package.json` file. These are disabled by default due to distribution issues (which will be solved in the future), but will enable husky and other tools.
- run `npm install` to execute the post install hooks. 

After that, make your modifications and then run `npm run build` to validate them. 

After you are done with your changes you can publish them by creating a distributable version.

### Enabling postinstall scripts

To enable `postinstall` scripts you need to modify the `package.json` file, specifically the `scripts` section and change this line:

```
"_postinstall": "scripts/postinstall",
``` 
to 
```
"postinstall": "scripts/postinstall",
```

### Husky and linters

We use husky to check linters and code styles on commits, if you commit your
changes and the commit fails on lint or prettier checks you can use these command
to check and fix the errors before trying to commit again:

* `npm run lint`: to check linter bugs
* `npm run lint:fix`: to fix linter bugs
* `npm run prettier`: to check codestyles errors
* `npm run prettier:fix`: to fix codestyles errors

### Generating a new distributable version

**IMPORTANT: when you publish a version postinstall scripts must be disabled. This is disabled by default, so don't push any changes to the postinstall scripts section in the `package.json` file.**

1. Run the `npm run dist` command to generate the `dist` folder with the distributable version inside.
2. Bump the version on the `package.json` file (not strictly needed).
3. Commit and push any changes, including the version bump.

#### For GitHub

1. Run `npm pack` to generate the tarball to be published as a release on GitHub.
2. Generate a new release on GitHub and upload the generated tarball.

#### For NPM

1. Run `npm login` to login to your account on npm registry.
2. Run `npm publish` to generate the distributable version for NodeJS.

#### For direct use (no publishing)

No extra steps are needed beyond generating the `dist` folder and merging it to `master`.
