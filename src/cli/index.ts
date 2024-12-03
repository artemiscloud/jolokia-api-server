#! /usr/bin/env -S node --no-warnings

import dotenv from 'dotenv';

import { ServerAccess } from './server-access';
import { printError } from './context';
import { Cli, mainCommand } from './cli';

export const main = (args: string[]) => {
  dotenv.config({ path: '.cli.env' });

  if (process.env['NODE_TLS_REJECT_UNAUTHORIZED'] !== '0') {
    console.log('Warning: TLS Certificate check is disabled.');
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  }

  mainCommand.parse(args);

  const cliOpts = mainCommand.opts();

  const apiServerUrl = cliOpts.url;

  const serverAccess = new ServerAccess(apiServerUrl);

  serverAccess
    .checkApiServer()
    .then((result) => {
      if (!result) {
        printError('The api server is not available', apiServerUrl);
        process.exit(1);
      }
      Cli.start(serverAccess, cliOpts, mainCommand);
    })
    .catch((e) => {
      printError('Error checking api server: ' + apiServerUrl, e);
      process.exit(1);
    });
};

main(process.argv);
