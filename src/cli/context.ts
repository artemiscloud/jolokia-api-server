import { Command } from 'commander';
import { ServerAccess } from './server-access';

export class JolokiaEndpoint {
  isRemote = (): boolean => {
    return false;
  };
  getUrl = (): string => {
    return '';
  };

  getBrokerName = (): string => {
    return '';
  };

  setBrokerName = (name: string): void => {
    throw new Error('Method not implemented. setBrokerName(' + name + ')');
  };
}

export class RemoteJolokiaEndpoint extends JolokiaEndpoint {
  endpointName: string;

  constructor(endpointName: string) {
    super();
    this.endpointName = endpointName;
  }

  isRemote = (): boolean => {
    return true;
  };

  getBrokerName = (): string => {
    return this.endpointName;
  };

  setBrokerName = (name: string) => {
    this.endpointName = name;
  };
}

export class LocalJolokiaEndpoint extends JolokiaEndpoint {
  brokerName: string;
  userName: string;
  password: string;
  jolokiaHost: string;
  scheme: string;
  port: string;
  accessToken: string;
  url: string;

  constructor(
    endpointName: string,
    userName: string,
    password: string,
    jolokiaHost: string,
    scheme: string,
    port: string,
    accessToken: string,
  ) {
    super();
    this.brokerName = endpointName;
    this.userName = userName;
    this.password = password;
    this.jolokiaHost = jolokiaHost;
    this.scheme = scheme;
    this.port = port;
    this.accessToken = accessToken;
  }

  getBrokerName = (): string => {
    return this.brokerName;
  };

  setBrokerName = (name: string) => {
    this.brokerName = name;
  };

  getUrl = () => {
    return this.scheme + '://' + this.jolokiaHost + ':' + this.port;
  };
}

const replaceErrors = (key: any, value: any) => {
  if (key === 'details') {
    if (value instanceof Error) {
      const error = {};

      Object.getOwnPropertyNames(value).forEach(function (propName) {
        error[propName] = value[propName];
      });

      return error;
    }
    try {
      if (value instanceof Response) {
        return { status: value.status, statusText: value.statusText };
      }
    } catch (e) {
      //this happens with tests where jest removes fetch API inlcuding the Response type
      //it will throw ReferenceError on Response type.
      return value;
    }
  }

  return value;
};

export const printResult = (result: object) => {
  console.log(JSON.stringify(result, null, 2));
};

export const printError = (message: string, detail?: object | string) => {
  console.error(
    JSON.stringify(
      {
        message: 'Error: ' + message,
        details: detail ? detail : '',
      },
      replaceErrors,
      2,
    ),
  );
};

export class CommandContext {
  runClusterConnectionOperation = async (
    remoteEndpoint: string,
    compName: string,
    operation: string,
    argStr: string,
  ): Promise<number> => {
    let retValue = 0;
    const args = ServerAccess.parseOperationArgs(argStr);
    try {
      const values = await this.apiClient.runClusterConnectionOperation(
        remoteEndpoint,
        compName,
        operation,
        args,
      );
      printResult(values);
    } catch (e) {
      printError('failed to run operation', e);
      retValue = 1;
    }
    return retValue;
  };

  runAcceptorOperation = async (
    remoteEndpoint: string,
    compName: string,
    operation: string,
    argStr: string,
  ): Promise<number> => {
    let retValue = 0;
    const args = ServerAccess.parseOperationArgs(argStr);
    try {
      const values = await this.apiClient.runAcceptorOperation(
        remoteEndpoint,
        compName,
        operation,
        args,
      );
      printResult(values);
    } catch (e) {
      printError('failed to run operation', e);
      retValue = 1;
    }
    return retValue;
  };

  runAddressOperation(
    remoteEndpoint: string,
    compName: string,
    operation: string,
  ): number | PromiseLike<number> {
    throw new Error('Method not implemented.');
  }
  runQueueOperation(
    remoteEndpoint: string,
    compName: string,
    operation: string,
    argStr: string,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  apiClient: ServerAccess;
  currentEndpoint: JolokiaEndpoint;

  constructor(
    serverAccess: ServerAccess,
    endpointUrl: string,
    endpoint: JolokiaEndpoint | null,
  ) {
    this.apiClient = serverAccess;

    if (endpointUrl) {
      const url = new URL(endpointUrl);
      this.currentEndpoint = new LocalJolokiaEndpoint(
        'current',
        url.username,
        url.password,
        url.hostname,
        url.protocol.substring(0, url.protocol.length - 1),
        this.getActualPort(url),
        '',
      );
    } else {
      this.currentEndpoint = endpoint as JolokiaEndpoint;
    }
  }

  getActualPort(url: URL): string {
    return url.port === ''
      ? url.protocol === 'http:'
        ? '80'
        : '443'
      : url.port;
  }

  // this login is used to login a jolokia endpoint
  async login(): Promise<number> {
    const current = this.currentEndpoint as LocalJolokiaEndpoint;
    if (!current || current.accessToken !== '') {
      return 0;
    }
    const result = await this.apiClient.login(current);
    if (result.status === 'success') {
      const accessToken = result['jolokia-session-id'];
      this.apiClient.updateClientHeader('jolokia-session-id', accessToken);
      current.accessToken = accessToken;
      return 0;
    }
    return 1;
  }

  async processCommand(args: string[]): Promise<number> {
    let retValue = 0;
    let resolvedArgs = args;
    if (args.length === 1) {
      // the command is quoted
      resolvedArgs = args[0].trim().split(' ');
    }

    switch (resolvedArgs[0]) {
      case 'get': {
        const getCmd = this.newGetCmd();
        try {
          await getCmd.parseAsync(resolvedArgs, { from: 'electron' });
        } catch (e) {
          printError('failed to execute get command', e);
          retValue = 1;
        }
        break;
      }
      case 'run': {
        const runCmd = this.newRunCmd();
        try {
          await runCmd.parseAsync(resolvedArgs, { from: 'electron' });
        } catch (e) {
          printError('failed to execute run command', e);
          retValue = 1;
        }
        break;
      }
      default:
        printError('unknown command', args);
        retValue = 1;
        break;
    }
    return retValue;
  }

  static parseGetPath = async (
    path: string,
    currentEndpoint: JolokiaEndpoint,
    callback: (targetType: string, remoteEndpoint: string) => Promise<void>,
  ): Promise<void> => {
    //for non-interactive mode if
    // path = '/' : to get all components of the target broker
    // path = '/<type>' : to get all components of <type>
    // path = '<type>' : same as '/<type>'
    let targetType = '';
    let targetEndpoint: string = null;

    const pathElements = path.split('/');
    if (pathElements.length === 1) {
      if (pathElements[0].startsWith('@')) {
        //it means the endpoint not the target type
        targetEndpoint = pathElements[0].substring(1);
      } else {
        targetType = pathElements[0];
      }
    } else if (pathElements.length === 2) {
      targetType = pathElements[1];
      if (pathElements[0].startsWith('@')) {
        targetEndpoint = pathElements[0].substring(1);
      }
    } else {
      throw 'Invalid target expression: ' + path;
    }

    if (!targetEndpoint && currentEndpoint?.isRemote()) {
      targetEndpoint = currentEndpoint.getBrokerName().substring(1);
    }

    await callback(targetType, targetEndpoint);
  };

  newGetCmd(): Command {
    const getCmd = new Command('get')
      .description('get information from a endpoint')
      .argument(
        '<path>',
        'path of the component with format [[@]endpointName/componentType] where @ means a remote target',
      )
      .argument('[compName]', 'name of the component', '')
      .option(
        '-a, --attributes <attributeNames...>',
        'get attributes from component',
      )
      .option(
        '-o, --operations <operationNames...>',
        'get operations info from component',
      )
      .exitOverride()
      .showHelpAfterError()
      .action(async (path, compName, options, cmd): Promise<void> => {
        await CommandContext.parseGetPath(
          path,
          this.currentEndpoint,
          async (targetType, remoteEndpoint) => {
            if (compName === '') {
              // read all comps of type
              if (targetType === '') {
                // '/' get broker info
                if (
                  options.attributes?.length > 0 ||
                  options.operations?.length > 0
                ) {
                  if (options.attributes?.length > 0) {
                    await this.getComponentAttributes(
                      remoteEndpoint,
                      'broker',
                      '',
                      options.attributes[0] === '*' ? null : options.attributes,
                    );
                  }
                  if (options.operations?.length > 0) {
                    await this.getComponentOperations(
                      remoteEndpoint,
                      'broker',
                      '',
                      options.operations[0] === '*' ? null : options.operations,
                    );
                  }
                } else {
                  await this.getComponent(remoteEndpoint, 'broker', '');
                }
              } else if (targetType === '*') {
                // '/*' to get all components
                if (
                  options.attributes?.length > 0 ||
                  options.operations?.length > 0
                ) {
                  throw Error(
                    'cannot specify attributes/operations for all components',
                  );
                } else {
                  await this.getAllComponents(remoteEndpoint, '');
                }
              } else {
                // '/type' read all comps of type
                if (
                  options.attributes?.length > 0 ||
                  options.operations?.length > 0
                ) {
                  throw 'need a component name to get attributes/operations of';
                }
                await this.getAllComponents(remoteEndpoint, targetType);
              }
            } else {
              if (
                options.attributes?.length > 0 ||
                options.operations?.length > 0
              ) {
                if (options.attributes?.length > 0) {
                  // '/type or type -a ...' read one comp's attributes
                  await this.getComponentAttributes(
                    remoteEndpoint,
                    targetType,
                    compName,
                    options.attributes[0] === '*' ? null : options.attributes,
                  );
                }
                if (options.operations?.length > 0) {
                  await this.getComponentOperations(
                    remoteEndpoint,
                    targetType,
                    compName,
                    options.operations[0] === '*' ? null : options.operations,
                  );
                }
              } else {
                //nothing specified, just return type info
                await this.getComponent(remoteEndpoint, targetType, compName);
              }
            }
          },
        );
      });
    return getCmd;
  }

  newRunCmd(): Command {
    const runCmd = new Command('run')
      .description('invoke a remote operation on an mbean of an endpoint.')
      .argument(
        '<path>',
        'path of the component with format [[@]endpointName/componentType] where @ means a remote target',
      )
      .argument('[compName]', 'name of the component', '')
      .argument(
        '[operation...]',
        'the operation to execute. The syntax is opName(args...)',
      )
      .exitOverride()
      .showHelpAfterError()
      .action(async (path, compName, operation, cmd): Promise<void> => {
        //combind the two to deal with spaces in the operation signature
        //sth like listAddresses('arg that has spaces', arg2 ...)
        let rawCmdArg = compName;
        if (operation) {
          operation.forEach((p: string) => {
            rawCmdArg += ' ' + p;
          });
        }
        rawCmdArg = ServerAccess.normalize(rawCmdArg);
        // group 2: comp name group3: oper name group4: args
        const opRegex =
          /(([a-zA-Z0-9\-_.]*)[\s]+)?([a-zA-Z0-9]+)[\s]*\((.*)\)\s*$/;
        const matches = opRegex.exec(rawCmdArg);

        let argStr = '';
        if (matches) {
          compName = matches[2] ?? '';
          operation = matches[3];
          argStr = matches[4];
        } else {
          throw Error('Invalid command');
        }

        await CommandContext.parseGetPath(
          path,
          this.currentEndpoint,
          async (targetType, remoteEndpoint) => {
            if (compName === '') {
              if (targetType === '') {
                // '/' exec broker operation
                await this.runComponentOperation(
                  remoteEndpoint,
                  'broker',
                  '',
                  operation,
                  argStr,
                );
              } else {
                // target type without compName is not allowed
                throw Error(
                  'must specify a component name for type ' + targetType,
                );
              }
            } else {
              // exec one comp's operation
              await this.runComponentOperation(
                remoteEndpoint,
                targetType,
                compName,
                operation,
                argStr,
              );
            }
          },
        );
      });
    return runCmd;
  }

  runBrokerOperation = async (
    remoteEndpoint: string,
    operation: string,
    argStr: string,
  ): Promise<number> => {
    let retValue = 0;
    const args = ServerAccess.parseOperationArgs(argStr);
    try {
      const values = await this.apiClient.runBrokerOperation(
        remoteEndpoint,
        operation,
        args,
      );
      printResult(values);
    } catch (e) {
      printError('failed to run operation', e);
      retValue = 1;
    }
    return retValue;
  };

  runComponentOperation = async (
    remoteEndpoint: string,
    targetType: string,
    compName: string,
    operation: string,
    argStr: string,
  ): Promise<number> => {
    switch (targetType) {
      case 'broker':
        return await this.runBrokerOperation(remoteEndpoint, operation, argStr);
      case 'queue':
      case 'queues':
        return await this.runQueueOperation(
          remoteEndpoint,
          compName,
          operation,
          argStr,
        );
      case 'address':
      case 'addresses':
        return await this.runAddressOperation(
          remoteEndpoint,
          compName,
          operation,
        );
      case 'acceptor':
      case 'acceptors':
        return await this.runAcceptorOperation(
          remoteEndpoint,
          compName,
          operation,
          argStr,
        );
      case 'cluster-connection':
      case 'cluster-connections':
        return await this.runClusterConnectionOperation(
          remoteEndpoint,
          compName,
          operation,
          argStr,
        );
      default:
        printError('Error: component type not supported', targetType);
        return 1;
    }
  };

  async getComponent(
    remoteEndpoint: string,
    targetType: string,
    compName: string,
  ): Promise<number> {
    switch (targetType) {
      case 'broker':
        return await this.getBroker(remoteEndpoint);
      case 'queue':
      case 'queues':
        return await this.getQueue(remoteEndpoint, compName);
      case 'address':
      case 'addresses':
        return await this.getAddress(remoteEndpoint, compName);
      case 'acceptor':
      case 'acceptors':
        return await this.getAcceptor(remoteEndpoint, compName);
      default:
        printError('component type not supported', targetType);
        return 1;
    }
  }

  async getAllBrokerComponents(remoteTarget: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getBrokerComponents(remoteTarget);
      printResult(result);
    } catch (ex) {
      printError('failed to get broker components', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAllQueueComponents(remoteTarget: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getQueues(remoteTarget);
      printResult(result);
    } catch (ex) {
      printError(
        'failed to get queues at ' + remoteTarget ? remoteTarget : 'current',
        ex,
      );
      retValue = 1;
    }
    return retValue;
  }

  async getAllAddresses(remoteTarget: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getAddresses(remoteTarget);
      printResult(result);
    } catch (ex) {
      printError('failed to get addresses', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAllAcceptors(remoteTarget: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getAcceptors(remoteTarget);
      printResult(result);
    } catch (ex) {
      printError('failed to get acceptors', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAllClusterConnections(remoteTarget: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getClusterConnections(remoteTarget);
      printResult(result);
    } catch (ex) {
      printError('failed to get cluster connections', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAllComponents(
    remoteEndpoint: string,
    targetType: string,
  ): Promise<number> {
    switch (targetType) {
      case '':
        return await this.getAllBrokerComponents(remoteEndpoint);
      case 'queue':
      case 'queues':
        return await this.getAllQueueComponents(remoteEndpoint);
      case 'address':
      case 'addresses':
        return await this.getAllAddresses(remoteEndpoint);
      case 'acceptor':
      case 'acceptors':
        return await this.getAllAcceptors(remoteEndpoint);
      case 'cluster-connection':
      case 'cluster-connections':
        return await this.getAllClusterConnections(remoteEndpoint);
      case 'bridge':
      case 'bridges':
        printError('not implemented!');
        return 1;
      case 'broadcast-group':
      case 'broadcast-groups':
        printError('not implemented!');
        return 1;
      default:
        printError('component type not supported', targetType);
        return 1;
    }
  }

  async getQueue(remoteEndpoint: string, compName: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getQueues(remoteEndpoint);
      const queues = result.filter((q) => q.name === compName);
      printResult(queues);
    } catch (ex) {
      printError('failed to get queues', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAddress(remoteTarget: string, compName: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getAddresses(remoteTarget);
      const addresses = result.filter((a) => a.name === compName);
      printResult(addresses);
    } catch (ex) {
      printError('failed to get addresses', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getAcceptor(remoteTarget: string, compName: string): Promise<number> {
    let retValue = 0;
    try {
      const result = await this.apiClient.getAcceptors(remoteTarget);
      const acceptors = result.filter((a) => a.name === compName);
      printResult(acceptors);
    } catch (ex) {
      printError('failed to get acceptors', ex);
      retValue = 1;
    }
    return retValue;
  }

  async getClusterConnectionOperations(
    remoteTarget: string,
    operations: string[],
    ccName: string,
  ): Promise<number> {
    let retValue = 0;
    const opts = { name: ccName };
    const opOpts = operations === null ? {} : { names: operations };
    try {
      const values = await this.apiClient.readClusterConnectionOperations(
        remoteTarget,
        opts,
        opOpts,
      );
      //JSON.stringify doesn't work well with maps
      const result = Array.from(values);
      printResult(result);
    } catch (e) {
      printError('failed to read queue attributes', e);
      retValue = 1;
    }
    return retValue;
  }

  async getQueueOperations(
    remoteTarget: string,
    operations: string[],
    queueName: string,
  ): Promise<number> {
    let retValue = 0;
    const opOpts = operations === null ? {} : { names: operations };
    const result = await this.apiClient.getQueues(remoteTarget);
    const queues = result.filter((q) => q.name === queueName);
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      const opts = {
        addressName: q.address?.name,
        name: queueName,
        routingType: q['routing-type'],
      };
      try {
        const values = await this.apiClient.readQueueOperations(
          remoteTarget,
          opts,
          opOpts,
        );
        //JSON.stringify doesn't work well with maps
        const result = Array.from(values);
        printResult(result);
      } catch (e) {
        printError('failed to read queue operations', e);
        retValue = 1;
        break;
      }
    }
    return retValue;
  }

  async getAddressOperations(
    remoteTarget: string,
    operations: string[],
    addrName: string,
  ): Promise<number> {
    let retValue = 0;
    const opts = { name: addrName };
    const opOpts = operations === null ? {} : { names: operations };
    try {
      const values = await this.apiClient.readAddressOperations(
        remoteTarget,
        opts,
        opOpts,
      );
      //JSON.stringify doesn't work well with maps
      const result = Array.from(values);
      printResult(result);
    } catch (e) {
      printError('failed to read address operations', e);
      retValue = 1;
    }
    return retValue;
  }

  async getAcceptorOperations(
    remoteTarget: string,
    operations: string[],
    acceptorName: string,
  ): Promise<number> {
    let retValue = 0;
    const opts = { name: acceptorName };
    const opOpts = operations === null ? {} : { names: operations };
    try {
      const values = await this.apiClient.readAcceptorOperations(
        remoteTarget,
        opts,
        opOpts,
      );
      //JSON.stringify doesn't work well with maps
      const result = Array.from(values);
      printResult(result);
    } catch (e) {
      printError('failed to read acceptor operations', e);
      retValue = 1;
    }
    return retValue;
  }

  async getBrokerOperations(
    remoteTarget: string,
    operations: string[],
  ): Promise<number> {
    let retValue = 0;
    const opts = operations === null ? {} : { names: operations };
    try {
      const values = await this.apiClient.readBrokerOperations(
        remoteTarget,
        opts,
      );
      //JSON.stringify doesn't work well with maps
      const result = Array.from(values);
      printResult(result);
    } catch (e) {
      printError('failed to read operationss', e);
      retValue = 1;
    }
    return retValue;
  }

  async getBrokerAttributes(
    remoteTarget: string,
    attributes: string[],
  ): Promise<number> {
    let retValue = 0;
    const opts = attributes === null ? {} : { names: attributes };
    try {
      const values = await this.apiClient.readBrokerAttributes(
        remoteTarget,
        opts,
      );
      printResult(values);
    } catch (e) {
      printError('failed to read attributes', e);
      retValue = 1;
    }
    return retValue;
  }

  async getQueueAttributes(
    remoteTarget: string,
    compName: string,
    attributes: string[],
  ): Promise<number> {
    let retValue = 0;
    const result = await this.apiClient.getQueues(remoteTarget);
    const queues = result.filter((q) => q.name === compName);
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      const opts =
        attributes === null
          ? {
              name: compName,
              address: q.address?.name,
              'routing-type': q['routing-type'],
            }
          : {
              name: compName,
              address: q.address?.name,
              'routing-type': q['routing-type'],
              attrs: attributes,
            };

      try {
        const values = await this.apiClient.readQueueAttributes(
          remoteTarget,
          opts,
        );
        printResult(values);
      } catch (e) {
        printError('failed to read queue attributes', e);
        retValue = 1;
        break;
      }
    }
    return retValue;
  }

  async getAddressAttributes(
    remoteTarget: string,
    compName: string,
    attributes: string[],
  ): Promise<number> {
    let retValue = 0;
    const opts =
      attributes === null
        ? { name: compName }
        : { name: compName, attrs: attributes };
    try {
      const values = await this.apiClient.readAddressAttributes(
        remoteTarget,
        opts,
      );
      printResult(values);
    } catch (e) {
      printError('failed to read address attributes', e);
      retValue = 1;
    }
    return retValue;
  }

  async getAcceptorAttributes(
    remoteTarget: string,
    compName: string,
    attributes: string[],
  ): Promise<number> {
    let retValue = 0;
    const opts =
      attributes === null
        ? { name: compName }
        : { name: compName, attrs: attributes };
    try {
      const values = await this.apiClient.readAcceptorAttributes(
        remoteTarget,
        opts,
      );
      printResult(values);
    } catch (e) {
      printError('failed to read acceptor attributes', e);
      retValue = 1;
    }
    return retValue;
  }
  async getClusterConnectionAttributes(
    remoteTarget: string,
    compName: string,
    attributes: string[],
  ): Promise<number> {
    let retValue = 0;
    const opts =
      attributes === null
        ? { name: compName }
        : { name: compName, attrs: attributes };
    try {
      const values = await this.apiClient.readClusterConnectionAttributes(
        remoteTarget,
        opts,
      );
      printResult(values);
    } catch (e) {
      printError('failed to read cluster connection attributes', e);
      retValue = 1;
    }
    return retValue;
  }

  getComponentAttributes = async (
    remoteEndpoint: string,
    targetType: string,
    compName: string,
    attributes: string[],
  ): Promise<number> => {
    switch (targetType) {
      case 'broker':
        return await this.getBrokerAttributes(remoteEndpoint, attributes);
      case 'queue':
      case 'queues':
        return await this.getQueueAttributes(
          remoteEndpoint,
          compName,
          attributes,
        );
      case 'address':
      case 'addresses':
        return await this.getAddressAttributes(
          remoteEndpoint,
          compName,
          attributes,
        );
      case 'acceptor':
      case 'acceptors':
        return await this.getAcceptorAttributes(
          remoteEndpoint,
          compName,
          attributes,
        );
      case 'cluster-connection':
      case 'cluster-connections':
        return await this.getClusterConnectionAttributes(
          remoteEndpoint,
          compName,
          attributes,
        );
      default:
        printError('Error: component type not supported', targetType);
        return 1;
    }
  };

  getComponentOperations = async (
    remoteEndpoint: string,
    targetType: string,
    compName: string,
    operations: string[],
  ): Promise<number> => {
    switch (targetType) {
      case 'broker': {
        return await this.getBrokerOperations(remoteEndpoint, operations);
      }
      case 'queue':
      case 'queues': {
        return await this.getQueueOperations(
          remoteEndpoint,
          operations,
          compName,
        );
      }
      case 'address':
      case 'addresses': {
        return await this.getAddressOperations(
          remoteEndpoint,
          operations,
          compName,
        );
      }
      case 'acceptor':
      case 'acceptors': {
        return await this.getAcceptorOperations(
          remoteEndpoint,
          operations,
          compName,
        );
      }
      case 'cluster-connection':
      case 'cluster-connections': {
        return await this.getClusterConnectionOperations(
          remoteEndpoint,
          operations,
          compName,
        );
      }
      default:
        printError('Error: component type not supported', targetType);
        return 1;
    }
  };

  async getBroker(remoteEndpoint: string): Promise<number> {
    let retValue = 0;
    try {
      const values = await this.apiClient.getBrokers(remoteEndpoint);
      printResult(values);
    } catch (ex) {
      printError('failed to get brokers', ex);
      retValue = 1;
    }
    return retValue;
  }
}

export class InteractiveCommandContext extends CommandContext {
  readonly endpoints: Map<string, CommandContext>;

  constructor(
    serverAccess: ServerAccess,
    endpointMap: Map<string, CommandContext>,
  ) {
    super(serverAccess, '', null);
    this.endpoints = endpointMap;
  }

  getPrompt(): string {
    const currentUser = this.apiClient.currentUser ?? undefined;
    if (this.currentEndpoint) {
      if (currentUser) {
        return currentUser + ':' + this.currentEndpoint.getBrokerName() + '> ';
      }
      return this.currentEndpoint.getBrokerName() + '> ';
    }
    if (currentUser) {
      return currentUser + '> ';
    }
    return '> ';
  }

  hasEndpoint(endpointName: string): boolean {
    return this.endpoints.has(endpointName);
  }

  newAddCmd(): Command {
    const addCmd = new Command('add')
      .argument('<name>', 'name of the endpoint')
      .argument('<endpoint>', 'the endpoint url')
      .option('-u, --user [userName]', 'the user name', 'user')
      .option('-p, --password [password]', 'the password', 'password')
      .exitOverride()
      .showHelpAfterError()
      .description(
        'add an jolokia endpoint, example: add mybroker0 http://localhost:8161',
      )
      .action(async (endpointName, endpointUrl, options) => {
        const url = new URL(endpointUrl);
        if (this.hasEndpoint(endpointName)) {
          printError('endpoint already exists!');
          return;
        }

        const newEndpoint = new LocalJolokiaEndpoint(
          endpointName,
          options.user,
          options.password,
          url.hostname,
          url.protocol.substring(0, url.protocol.length - 1),
          this.getActualPort(url),
          '',
        );
        const context = new CommandContext(this.apiClient, '', newEndpoint);
        try {
          await context.login();
          context.currentEndpoint.setBrokerName(endpointName);
          this.endpoints.set(endpointName, context);
          this.switchContext(context);
        } catch (ex) {
          printError('failed to login', ex);
        }
      });

    return addCmd;
  }

  addEndpoint = async (args: string[]): Promise<number> => {
    let retValue = 0;
    const addCmd = this.newAddCmd();
    try {
      await addCmd.parseAsync(args, { from: 'electron' }).catch(() => {
        //commander would print the error message
        retValue = 1;
      });
    } catch (ex) {
      printError('failed to execute add command', ex);
      retValue = 1;
    }
    return retValue;
  };

  getEndpoint = (endpointName: string): CommandContext | undefined => {
    return this.endpoints.get(endpointName);
  };

  listJolokiaEndpoints = async (): Promise<number> => {
    const endpointList = new Array<string>();
    this.endpoints.forEach((context, key) => {
      endpointList.push(key + '(local): ' + context.currentEndpoint.getUrl());
    });

    const remoteEndpoints = await this.apiClient.listEndpoints();
    remoteEndpoints.forEach((e) => {
      endpointList.push('@' + e.name + ': ' + e.url);
    });
    printResult(endpointList);

    return 0;
  };

  switchContext(target: CommandContext) {
    this.apiClient = target.apiClient;
    this.currentEndpoint = target.currentEndpoint;
  }

  newSwitchCmd(): Command {
    const switchCmd = new Command('switch')
      .argument('<endpointName>')
      .description('switch to a jolokia endpoint')
      .exitOverride()
      .action(async (endpointName) => {
        if (endpointName.startsWith('@')) {
          this.currentEndpoint = new RemoteJolokiaEndpoint(endpointName);
        } else {
          if (!this.hasEndpoint(endpointName)) {
            printError('no such endpoint', endpointName);
          } else {
            const target = this.getEndpoint(endpointName) as CommandContext;
            this.switchContext(target);
          }
        }
      });
    return switchCmd;
  }

  async switchJolokiaEndpoint(args: string[]): Promise<number> {
    let retValue = 0;
    const switchCmd = this.newSwitchCmd();
    try {
      switchCmd.parse(args, { from: 'electron' });
    } catch (ex) {
      printError('failed to execute switch command', ex);
      retValue = 1;
    }
    return retValue;
  }

  // command path is in form:
  // [[@]endpointName]/[componentType]
  // if @ is present it means endpointName is targeted at api server
  // if @ is not present it means a local endpoint
  // if endpointName part is absent at all it means current local endpoint
  // componentType is the target component of a broker (queues, address, etc)
  // if componentType is absent it means all components of the broker
  // if path is / it gets the mbean info of the current broker.
  getContextForCmd(path: string): CommandContext {
    if (!path) {
      return this;
    }

    const isRemoteTarget =
      path.startsWith('@') || this.currentEndpoint?.isRemote();

    if (!isRemoteTarget) {
      if (this.endpoints.size === 0) {
        throw Error('there is no endpoint for command');
      }

      const elements = path.split('/');
      if (elements.length === 2 && elements[0] !== '') {
        if (this.hasEndpoint(elements[0])) {
          if (elements[0] === this.currentEndpoint?.getBrokerName()) {
            return this;
          } else {
            return this.getEndpoint(elements[0]) as CommandContext;
          }
        } else {
          throw Error('target endpoint not exist: ' + elements[0]);
        }
      }
    }
    return this;
  }

  async processSingleCommand(cmd: string): Promise<number> {
    const args = cmd.trim().split(' ');
    switch (args[0]) {
      case '':
        return 0;
      case 'add':
        return await this.addEndpoint(args);
      case 'list':
        return await this.listJolokiaEndpoints();
      case 'switch':
        return this.switchJolokiaEndpoint(args);
      case 'get':
      case 'run': {
        let context: CommandContext;
        try {
          context = this.getContextForCmd(args[1]);
        } catch (ex) {
          printError('failed to get context', ex);
          return 1;
        }
        return await context.processCommand([cmd.trim()]);
      }
      default: {
        printError('unknown command');
        return 1;
      }
    }
  }
}
