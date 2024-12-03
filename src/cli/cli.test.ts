import {
  CommandContext,
  InteractiveCommandContext,
  LocalJolokiaEndpoint,
  RemoteJolokiaEndpoint,
} from './context';
import { ServerAccess } from './server-access';
import { mainCommand } from './cli';
import { ApigenConfig, JavaTypes } from './api-client';

const apiServerUrl = 'https://localhost:9444';

jest.mock('./api-client', () => {
  return {
    ApiClient: jest.fn().mockImplementation(() => {
      return {
        Config: {},
        constructor(config?: Partial<ApigenConfig>) {
          this.Config = { baseUrl: '/', headers: {}, ...config };
        },
        admin: {
          listEndpoints: async () => {
            return [];
          },
        },
        development: {
          apiInfo: async () => {
            return {
              message: {
                security: {
                  enabled: false,
                },
                info: {},
                paths: {},
              },
              status: 'successful',
              'jolokia-session-id': 'id',
            };
          },
        },
        security: {
          login: () => {
            return {
              message: 'success',
              status: 'success',
              'jolokia-session-id': 'jolokia-session-id',
            };
          },
          serverLogin: async () => {
            return {
              message: 'success',
              status: 'success',
              bearerToken: 'token',
            };
          },
        },
        jolokia: {
          getBrokers: () => {
            return [{ name: 'amq-broker' }];
          },
          getAddresses: async () => {
            return [];
          },
          getQueues: () => {
            return [
              {
                name: 'ExpiryQueue',
                'routing-type': 'anycast',
                address: {
                  name: 'ExpiryQueue',
                  broker: {
                    name: 'amq-broker',
                  },
                },
                broker: {
                  name: 'amq-broker',
                },
              },
              {
                name: '$.artemis.internal.sf.my-cluster.153698c3-a4da-11ef-8309-e2930c7d3af5',
                'routing-type': 'multicast',
                address: {
                  name: '$.artemis.internal.sf.my-cluster.153698c3-a4da-11ef-8309-e2930c7d3af5',
                  broker: {
                    name: 'amq-broker',
                  },
                },
                broker: {
                  name: 'amq-broker',
                },
              },
              {
                name: 'DLQ',
                'routing-type': 'anycast',
                address: {
                  name: 'DLQ',
                  broker: {
                    name: 'amq-broker',
                  },
                },
                broker: {
                  name: 'amq-broker',
                },
              },
              {
                name: 'notif.e690a357-a550-11ef-8309-e2930c7d3af5.ActiveMQServerImpl_name',
                'routing-type': 'multicast',
                address: {
                  name: 'activemq.notifications',
                  broker: {
                    name: 'amq-broker',
                  },
                },
                broker: {
                  name: 'amq-broker',
                },
              },
            ];
          },
          getAcceptors: async () => {
            return [
              {
                name: 'new-acceptor',
                broker: {
                  name: 'amq-broker',
                },
              },
              {
                name: 'scaleDown',
                broker: {
                  name: 'amq-broker',
                },
              },
            ];
          },
          getClusterConnections: async () => {
            return [];
          },
          readAddressAttributes: () => {
            return [];
          },
          readBrokerAttributes: () => {
            return [];
          },
          readQueueAttributes: () => {
            return [];
          },
          readAcceptorAttributes: () => {
            return [];
          },
          readClusterConnectionAttributes: () => {
            return [];
          },
          getAcceptorDetails: async () => {
            return {
              op: {
                reload: [
                  {
                    args: [],
                    ret: 'void' as JavaTypes,
                  },
                ],
              },
            };
          },
          getBrokerDetails: async () => {
            return {
              op: {
                listAddresses: [
                  {
                    args: [
                      {
                        name: 'separator',
                        type: 'java.lang.String' as JavaTypes,
                      },
                    ],
                    ret: 'java.lang.String' as JavaTypes,
                  },
                ],
              },
            };
          },
          execBrokerOperation: async () => {
            return [];
          },
          getClusterConnectionDetails: async () => {
            return {
              op: {
                getBridgeMetrics: [
                  {
                    args: [
                      {
                        name: 'nodeId',
                        type: 'java.lang.String' as JavaTypes,
                      },
                    ],
                    ret: 'java.util.Map' as JavaTypes,
                  },
                ],
              },
            };
          },
          execClusterConnectionOperation: async () => {
            return [];
          },
        },
      };
    }),
  };
});

describe('test parsing', () => {
  it('test parsing paths', async () => {
    let path = '/';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = 'broker0/';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = '@broker0/';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('');
        expect(remoteEndpoint).toEqual('broker0');
      },
    );

    path = '/queue';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = 'local/queue';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = 'queue';
    await CommandContext.parseGetPath(
      path,
      null,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = '//';
    await CommandContext.parseGetPath(path, null, async () => {
      return;
    }).catch((err) => {
      expect(err).toEqual('Invalid target expression: ' + path);
    });

    const fakeEndpoint = new RemoteJolokiaEndpoint('@fake');
    const fakeLocalEndpoint = new LocalJolokiaEndpoint(
      'localone',
      'user',
      'pass',
      'localhost',
      'http',
      '8161',
      '',
    );

    path = '/';
    await CommandContext.parseGetPath(
      path,
      fakeEndpoint,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('');
        expect(remoteEndpoint).toEqual('fake');
      },
    );

    path = '/queue';
    await CommandContext.parseGetPath(
      path,
      fakeEndpoint,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toEqual('fake');
      },
    );

    path = 'queue';
    await CommandContext.parseGetPath(
      path,
      fakeEndpoint,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toEqual('fake');
      },
    );

    path = '/queue';
    await CommandContext.parseGetPath(
      path,
      fakeLocalEndpoint,
      async (targetType, remoteEndpoint) => {
        console.log(targetType, remoteEndpoint);
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toBeNull();
      },
    );

    path = 'localone/queue';
    await CommandContext.parseGetPath(
      path,
      fakeLocalEndpoint,
      async (targetType, remoteEndpoint) => {
        expect(targetType).toEqual('queue');
        expect(remoteEndpoint).toBeNull();
      },
    );
  });
});

const execCommand = async (apiAccess: ServerAccess, cmd: string[]) => {
  const args = [
    '/usr/bin/node',
    'thecli',
    '-u',
    'root',
    '-p',
    'password',
    '-l',
    apiServerUrl,
    ...cmd,
  ];

  mainCommand.parse(args);

  const cliOpts = mainCommand.opts();

  const serverUrl = cliOpts.url;

  expect(serverUrl).toEqual(apiServerUrl);

  const result = await apiAccess.checkApiServer();
  expect(result).toBeTruthy();

  const commandContext = new CommandContext(
    apiAccess,
    mainCommand.opts().endpoint,
    null,
  );

  const ok = await commandContext.login();
  expect(ok).toEqual(0);

  const retval = await commandContext.processCommand(mainCommand.args);
  return retval;
};

describe('test command processing', () => {
  const serverAccess = new ServerAccess(apiServerUrl);

  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it('test get command processing - getBrokers', async () => {
    const spyCall = jest.spyOn(serverAccess.apiClient.jolokia, 'getBrokers');
    const spyLog = jest.spyOn(console, 'log');
    await execCommand(serverAccess, ['get @broker0/']);
    expect(spyCall).toHaveBeenCalled();
    // verify once the output is formatted as json string
    expect(spyLog).toHaveBeenCalledWith(
      JSON.stringify([{ name: 'amq-broker' }], null, 2),
    );
  });

  it('test get command processing - get addresses', async () => {
    const spyCall = jest.spyOn(serverAccess.apiClient.jolokia, 'getAddresses');
    await execCommand(serverAccess, ['get @broker0/addresses']);
    expect(spyCall).toHaveBeenCalled();
  });

  it('test get command processing - get queues', async () => {
    const spyCall = jest.spyOn(serverAccess.apiClient.jolokia, 'getQueues');
    await execCommand(serverAccess, ['get @broker0/queues']);
    expect(spyCall).toHaveBeenCalled();
  });

  it('test get command processing - get acceptors', async () => {
    const spyCall = jest.spyOn(serverAccess.apiClient.jolokia, 'getAcceptors');
    await execCommand(serverAccess, ['get @broker0/acceptors']);
    expect(spyCall).toHaveBeenCalled();
  });

  it('test get command processing - get cluster-connections', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'getClusterConnections',
    );
    await execCommand(serverAccess, ['get @broker0/cluster-connections']);
    expect(spyCall).toHaveBeenCalled();
  });

  it('test get command processing - read broker attributes', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'readBrokerAttributes',
    );
    await execCommand(serverAccess, ['get @broker0/ -a Status']);
    expect(spyCall).toHaveBeenCalledWith({
      names: ['Status'],
      targetEndpoint: 'broker0',
    });
  });

  it('test get command processing - read address attributes', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'readAddressAttributes',
    );
    await execCommand(serverAccess, [
      'get @broker0/address DLQ -a AutoCreated,AddressSize',
    ]);
    expect(spyCall).toHaveBeenCalledWith({
      name: 'DLQ',
      attrs: ['AutoCreated,AddressSize'],
      targetEndpoint: 'broker0',
    });
  });

  it('test get command processing - read queue attributes', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'readQueueAttributes',
    );
    await execCommand(serverAccess, ['get @broker0/queue DLQ -a MessageCount']);
    expect(spyCall).toHaveBeenCalledWith({
      name: 'DLQ',
      address: 'DLQ',
      attrs: ['MessageCount'],
      'routing-type': 'anycast',
      targetEndpoint: 'broker0',
    });
  });

  it('test get command processing - read acceptor attributes', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'readAcceptorAttributes',
    );
    await execCommand(serverAccess, [
      'get @broker0/acceptors new-acceptor -a Started',
    ]);
    expect(spyCall).toHaveBeenCalledWith({
      name: 'new-acceptor',
      attrs: ['Started'],
      targetEndpoint: 'broker0',
    });
  });

  it('test get command processing - read cluster-connection attributes', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'readClusterConnectionAttributes',
    );
    await execCommand(serverAccess, [
      'get @broker0/cluster-connection my-cluster -a RetryInterval',
    ]);
    expect(spyCall).toHaveBeenCalledWith({
      name: 'my-cluster',
      attrs: ['RetryInterval'],
      targetEndpoint: 'broker0',
    });
  });

  it('test get command processing - get a component operations', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'getAcceptorDetails',
    );
    await execCommand(serverAccess, [
      'get @broker0/acceptor new-acceptor -o reload',
    ]);
    expect(spyCall).toHaveBeenCalledWith({
      name: 'new-acceptor',
      targetEndpoint: 'broker0',
    });
  });

  it('test run command processing - run a broker operation', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'execBrokerOperation',
    );
    await execCommand(serverAccess, ['run @broker0/ listAddresses(a)']);

    expect(spyCall).toHaveBeenCalledWith(
      {
        signature: {
          args: [
            {
              type: 'java.lang.String',
              value: 'a',
            },
          ],
          name: 'listAddresses',
        },
      },
      { targetEndpoint: 'broker0' },
    );
  });

  it('test run command processing - run a cluster-connection operation', async () => {
    const spyCall = jest.spyOn(
      serverAccess.apiClient.jolokia,
      'execClusterConnectionOperation',
    );
    await execCommand(serverAccess, [
      'run @broker0/cluster-connection my-cluster getBridgeMetrics(1538bbb4-a4da-11ef-a086-a6289ed42cb2)',
    ]);

    expect(spyCall).toHaveBeenCalledWith(
      {
        signature: {
          args: [
            {
              type: 'java.lang.String',
              value: '1538bbb4-a4da-11ef-a086-a6289ed42cb2',
            },
          ],
          name: 'getBridgeMetrics',
        },
      },
      {
        name: 'my-cluster',
        targetEndpoint: 'broker0',
      },
    );
  });
});

describe('test command processing - interactive commands', () => {
  const serverAccess = new ServerAccess(apiServerUrl);

  let commandContext: InteractiveCommandContext;

  beforeEach(() => {
    commandContext = new InteractiveCommandContext(
      serverAccess,
      new Map<string, CommandContext>(),
    );
  });

  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it('test add command processing', async () => {
    const spyLogin = jest.spyOn(serverAccess.apiClient.security, 'login');
    const cmd = 'add broker-0 http://127.0.0.1:8161 -u guest -p guest';
    const retval = await commandContext.processSingleCommand(cmd);
    expect(retval).toBe(0);
    expect(spyLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerName: 'broker-0',
        userName: 'guest',
        password: 'guest',
        jolokiaHost: '127.0.0.1',
        scheme: 'http',
        port: '8161',
        accessToken: 'jolokia-session-id',
      }),
    );
    expect(commandContext.currentEndpoint).not.toBeNull();
    expect(commandContext.currentEndpoint.getBrokerName()).toEqual('broker-0');
    expect(commandContext.currentEndpoint.getUrl()).toEqual(
      'http://127.0.0.1:8161',
    );
  });

  it('test list/switch command processing', async () => {
    const add1 = 'add broker-0 http://127.0.0.1:8161 -u guest -p guest';
    const ret1 = await commandContext.processSingleCommand(add1);
    expect(ret1).toBe(0);

    expect(commandContext.currentEndpoint).not.toBeNull();
    expect(commandContext.currentEndpoint.getBrokerName()).toEqual('broker-0');
    expect(commandContext.currentEndpoint.getUrl()).toEqual(
      'http://127.0.0.1:8161',
    );

    const add2 = 'add broker-1 http://127.0.0.2:8161 -u guest -p guest';
    const ret2 = await commandContext.processSingleCommand(add2);
    expect(ret2).toBe(0);

    expect(commandContext.currentEndpoint).not.toBeNull();
    expect(commandContext.currentEndpoint.getBrokerName()).toEqual('broker-1');
    expect(commandContext.currentEndpoint.getUrl()).toEqual(
      'http://127.0.0.2:8161',
    );

    //now switch to broker-0
    const switch1 = 'switch broker-0';
    const ret3 = await commandContext.processSingleCommand(switch1);
    expect(ret3).toBe(0);

    expect(commandContext.currentEndpoint).not.toBeNull();
    expect(commandContext.currentEndpoint.getBrokerName()).toEqual('broker-0');
    expect(commandContext.currentEndpoint.getUrl()).toEqual(
      'http://127.0.0.1:8161',
    );

    const spyOut = jest.spyOn(console, 'log');
    const list = 'list';
    const ret4 = await commandContext.processSingleCommand(list);
    expect(ret4).toBe(0);
    expect(spyOut).toHaveBeenCalledWith(
      JSON.stringify(
        [
          'broker-0(local): http://127.0.0.1:8161',
          'broker-1(local): http://127.0.0.2:8161',
        ],
        null,
        2,
      ),
    );
  });
});
