## Rif Relay Client

This typescript repository contains all the client code used by the Rif Relay System.
This project works as a dependency and needs to be installed in order to be used.

### Pre-Requisites

* Node version 12.18

#### How to use it

You can use this dependency once you have it installed on your project. You have a few
ways to installing this dependency:

* **Use a release version:** just install this using the install command for node `npm i --save @rsksmart/rif-relay-client`.
* **Use the distributable directly from the repository:** modify your `package.json` file
  to add this line `"@rsksmart/rif-relay-client": "https://github.com/JONAF2103/rif-relay-client",`
* **Use the development version directly from your changes:** clone this repository next to your project and modify your `package.json` file
  to add this line `"@rsksmart/rif-relay-client": "../rif-relay-client",`

#### How to generate a new distributable version

1. Bump the version on the `package.json` file.
2. Commit and push any changes included the bump.

#### For Github

1. Run `npm pack` to generate the tarball to be publish as release on github.
2. Generate a new release on github and upload the generated tarball.

#### For NPM

1. Run `npm login` to login to your account on npm registry.
2. Run `npm publish` to generate the distributable version for NodeJS

#### For direct use

1. Run `npm run dist` to generate the distributable version.
2. Commit and push the dist folder with the updated version to the repository on master.

**IMPORTANT: when you publish a version postinstall scripts must be disabled, if you
are publishing a new version on the repository directly you need to run `npm run switchPostInstall disable`
command to disable postinstall scripts since is not automatically disabled.
That is only automatically disabled when you run `npm publish` to publish your
library on node registry. If you want to enable postinstall scripts again for development you can run `npm run switchPostInstall enable`**

#### How to develop

If you need to modify resources inside this repository you can just make your modifications
and then run `npm run build` to validate them. After you are done with your changes you
can publish them by creating a distributable version for the consumers.

#### Husky and linters

We use husky to check linters and code styles on commits, if you commit your
changes and the commit fails on lint or prettier checks you can use these command
to check and fix the errors before trying to commit again:

* `npm run lint`: to check linter bugs
* `npm run lint:fix`: to fix linter bugs
* `npm run prettier`: to check codestyles errors
* `npm run prettier:fix`: to fix codestyles errors
