import figlet from 'figlet';
import readline from 'readline';
import { stdin, stdout } from 'process';

import {
  CommandContext,
  InteractiveCommandContext,
  printError,
} from './context';
import { ServerAccess } from './server-access';
import { Command, OptionValues } from 'commander';

export const mainCommand = new Command()
  .version('1.0.0')
  .description('CLI tool for ActiveMQ Artemis Jolokia API Server')
  .argument('[command]', 'the command to be executed')
  .option(
    '-l, --url [api-server-url]',
    'the url of api server',
    'https://localhost:9443',
  )
  .option('-i, --interactive', 'run in interactive mode', false)
  .option('-e, --endpoint [endpoint]', 'target jolokia endpoint url')
  .option(
    '-u, --user [userName]',
    'user name to log in to the api server if security is enabled',
    false,
  )
  .option(
    '-p, --password [password]',
    'user password to log in to the api server',
    false,
  );

export class Cli {
  static start = (
    serverAccess: ServerAccess,
    options: OptionValues,
    program: Command,
  ) => {
    let userName: string;
    let password: string;
    let shouldLogin = false;

    if (options.user) {
      if (!options.password) {
        printError('Error: no password');
        process.exit(1);
      }
      userName = options.user;
      password = options.password;
      shouldLogin = true;
    } else {
      if (process.env.SERVER_USER_NAME) {
        if (!process.env.SERVER_PASSWORD) {
          printError('Error: no password');
          process.exit(1);
        }
        userName = process.env.SERVER_USER_NAME;
        password = process.env.SERVER_PASSWORD;
        shouldLogin = true;
      }
    }

    if (shouldLogin) {
      serverAccess
        .loginServer(userName, password)
        .then((res) => {
          if (res.bearerToken) {
            serverAccess.updateBearerToken(res.bearerToken);
          }
          serverAccess.setLoginUser(userName);
          if (res.status !== 'success') {
            printError('Failed to login server', res);
            process.exit(1);
          }
          Cli.internalStart(serverAccess, options, program);
        })
        .catch((err) => {
          printError('Failed to login server', err);
          process.exit(1);
        });
    } else {
      Cli.internalStart(serverAccess, options, program);
    }
  };

  static internalStart = (
    serverAccess: ServerAccess,
    options: OptionValues,
    program: Command,
  ) => {
    if (options.interactive) {
      const endpointMap = new Map<string, CommandContext>();
      const commandContext = new InteractiveCommandContext(
        serverAccess,
        endpointMap,
      );

      const rl = readline.createInterface({
        input: stdin,
        output: stdout,
      });
      program.exitOverride(); //avoid exit on error

      const runMain = async () => {
        rl.question(commandContext.getPrompt(), function (command) {
          if (command === 'exit') {
            return rl.close();
          }
          if (command === 'help') {
            printInteractiveHelp();
            runMain();
          } else {
            commandContext
              .processSingleCommand(command)
              .then(() => {
                runMain();
              })
              .catch((e) => {
                printError('error processing command', e);
                runMain();
              });
          }
        });
      };
      console.log(figlet.textSync('Api Server Cli'));
      runMain();
    } else {
      const commandContext = new CommandContext(
        serverAccess,
        program.opts().endpoint,
        null,
      );

      commandContext
        .login()
        .then((value) => {
          if (value === 0) {
            commandContext
              .processCommand(program.args)
              .then((result) => {
                if (result === 0) {
                  process.exit(result);
                } else {
                  program.help({ error: true });
                }
              })
              .catch((e) => {
                printError('failed to run command', e);
                program.help({ error: true });
              });
          } else {
            program.help({ error: true });
          }
        })
        .catch((err) => {
          printError('failed to run command', err);
          program.help({ error: true });
        });
    }
  };
}

const availableInteractiveCommands = [
  { cmd: 'list', desc: 'list endpoints' },
  { cmd: 'add', desc: 'add a direct endpoint' },
  { cmd: 'switch', desc: 'switch current endpoint' },
  { cmd: 'get', desc: 'get component information' },
  { cmd: 'run', desc: 'run a component operation' },
  { cmd: 'exit', desc: 'exit the cli' },
];

const printInteractiveHelp = () => {
  console.log('Avaliable commands:');
  availableInteractiveCommands.forEach((item) => {
    console.log(item.cmd, ':', item.desc);
  });
};
