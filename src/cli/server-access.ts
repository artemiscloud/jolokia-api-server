import base64 from 'base-64';
import {
  ApiClient,
  ComponentDetails,
  JavaTypes,
  OperationArgument,
} from './api-client';
import { LocalJolokiaEndpoint } from './context';

export class JolokiaClient extends ApiClient {
  PrepareFetchUrl(path: string) {
    return new URL(`${this.Config.baseUrl}/${path}`.replace(/\/{2,}/g, '/'));
  }
}

export type ParameterDescriptor = {
  name: string;
  type: JavaTypes;
  desc: string;
};

// this need to go to openapi.yml
// The operation info returned
// is a map of OperationSchema array
// Map<string, OperationSchema[]>
// The key is the operation name
// each item in the array represents
// a variation of the operation (overloaded)
export type OperationSchema = {
  args: ParameterDescriptor[];
  ret: JavaTypes;
  desc: string;
};

export class ServerAccess {
  static readonly ARG_COLON = ':';
  static readonly ARG_SEP = ',';
  static readonly ARG_SEP_ESC = '___' + base64.encode(this.ARG_SEP) + '___';

  static readonly rpCommaEx = /\\,/g;
  static readonly rpCommaEscEx = new RegExp(
    String.raw`${ServerAccess.ARG_SEP_ESC}`,
    'g',
  );

  apiClient: JolokiaClient;
  currentUser: string;

  constructor(apiServerUrl: string) {
    this.apiClient = new JolokiaClient({
      baseUrl: apiServerUrl + '/api/v1/',
    });
  }
  // arguments are passed as is, if an argument has comma ,
  // it must be escaped as \,
  // in case of \ being the end of a arg, add a space \ ,
  static normalize = (value: string): string => {
    return value.replace(ServerAccess.rpCommaEx, ServerAccess.ARG_SEP_ESC);
  };

  static restore = (value: string): string => {
    return value.replace(ServerAccess.rpCommaEscEx, ServerAccess.ARG_SEP);
  };

  static removeArgName = (arg: string): string => {
    let argVal = arg;
    const index = argVal.indexOf(ServerAccess.ARG_COLON);
    if (index > 0) {
      argVal = arg.substring(index + ServerAccess.ARG_COLON.length);
    }
    return argVal;
  };

  static parseOperationArgs = (argStr: string): string[] => {
    let argArray = [];
    if (argStr) {
      argArray = argStr.split(',');
      argArray.forEach((val, index) => {
        argArray[index] = ServerAccess.restore(val);
      });
    }
    return argArray;
  };

  setLoginUser(userName: string) {
    this.currentUser = userName;
  }

  login = async (currentEndpoint: LocalJolokiaEndpoint) => {
    return this.apiClient.security.login(currentEndpoint);
  };

  checkApiServer = async (): Promise<boolean> => {
    return this.apiClient.development
      .apiInfo()
      .then((value) => {
        if (value.status === 'successful') {
          return true;
        }
        return false;
      })
      .catch(() => {
        return false;
      });
  };

  updateClientHeader = (name: string, accessToken: string) => {
    this.apiClient.Config.headers = {
      ...this.apiClient.Config.headers,
      [name]: accessToken,
    };
  };

  updateBearerToken(bearerToken: string) {
    this.apiClient.Config.headers = {
      ...this.apiClient.Config.headers,
      Authorization: 'Bearer ' + bearerToken,
    };
  }

  loginServer = async (userName: string, password: string) => {
    return this.apiClient.security.serverLogin({ userName, password });
  };

  getTargetOpts = (remoteTarget: string) => {
    return remoteTarget ? { targetEndpoint: remoteTarget } : {};
  };

  getBrokerComponents = async (remoteTarget: string) => {
    return this.apiClient.jolokia.getBrokerComponents(
      this.getTargetOpts(remoteTarget),
    );
  };

  getQueues = async (remoteTarget: string) => {
    return this.apiClient.jolokia.getQueues(this.getTargetOpts(remoteTarget));
  };

  getAddresses = async (remoteTarget: string) => {
    return this.apiClient.jolokia.getAddresses(
      this.getTargetOpts(remoteTarget),
    );
  };

  getAcceptors = async (remoteTarget: string) => {
    return this.apiClient.jolokia.getAcceptors(
      this.getTargetOpts(remoteTarget),
    );
  };

  getClusterConnections = async (remoteTarget: string) => {
    return this.apiClient.jolokia.getClusterConnections(
      this.getTargetOpts(remoteTarget),
    );
  };

  readBrokerAttributes = async (
    remoteTarget: string,
    opts: { names?: undefined } | { names: string[] },
  ) => {
    return this.apiClient.jolokia.readBrokerAttributes({
      ...opts,
      ...this.getTargetOpts(remoteTarget),
    });
  };

  filterOperations = (
    details: ComponentDetails,
    opts: { names?: undefined } | { names: string[] },
  ): Map<string, OperationSchema[]> => {
    const operations = new Map<string, OperationSchema[]>(
      Object.entries(details.op),
    );

    if (opts.names) {
      const matched = new Map<string, OperationSchema[]>();
      opts.names.forEach((n) => {
        // deal with commas
        const names = n.split(',');
        names.forEach((m) => {
          if (m !== '') {
            if (operations.has(m)) {
              matched.set(m, operations.get(m));
            }
          }
        });
      });
      return matched;
    }

    return operations;
  };

  readAddressOperations = async (
    remoteTarget: string,
    opts: { name?: undefined } | { name: string },
    opOpts: { names?: undefined } | { names: string[] },
  ): Promise<Map<string, OperationSchema[]>> => {
    return this.apiClient.jolokia
      .getAddressDetails({
        ...opts,
        ...this.getTargetOpts(remoteTarget),
      })
      .then((result) => {
        return this.filterOperations(result, opOpts);
      });
  };

  readAcceptorOperations = async (
    remoteTarget: string,
    opts: { name?: undefined } | { name: string },
    opOpts: { names?: undefined } | { names: string[] },
  ): Promise<Map<string, OperationSchema[]>> => {
    return this.apiClient.jolokia
      .getAcceptorDetails({
        ...opts,
        ...this.getTargetOpts(remoteTarget),
      })
      .then((result) => {
        return this.filterOperations(result, opOpts);
      });
  };

  readClusterConnectionOperations = async (
    remoteTarget: string,
    opts: { name?: undefined } | { name: string },
    opOpts: { names?: undefined } | { names: string[] },
  ): Promise<Map<string, OperationSchema[]>> => {
    return this.apiClient.jolokia
      .getClusterConnectionDetails({
        ...opts,
        ...this.getTargetOpts(remoteTarget),
      })
      .then((result) => {
        return this.filterOperations(result, opOpts);
      });
  };

  readQueueOperations = async (
    remoteTarget: string,
    opts: {
      addressName: string;
      name: string;
      routingType: string;
    },
    opOpts: { names?: undefined } | { names: string[] },
  ): Promise<Map<string, OperationSchema[]>> => {
    return this.apiClient.jolokia
      .getQueueDetails({
        ...opts,
        ...this.getTargetOpts(remoteTarget),
      })
      .then((result) => {
        return this.filterOperations(result, opOpts);
      });
  };

  readBrokerOperations = async (
    remoteTarget: string,
    opts: { names?: undefined } | { names: string[] },
  ): Promise<Map<string, OperationSchema[]>> => {
    return this.apiClient.jolokia
      .getBrokerDetails({
        ...this.getTargetOpts(remoteTarget),
      })
      .then((result) => {
        return this.filterOperations(result, opts);
      });
  };

  readQueueAttributes = async (
    remoteTarget: string,
    opts:
      | {
          name: string;
          address: string;
          'routing-type': string;
          attrs?: undefined;
        }
      | {
          name: string;
          address: string;
          'routing-type': string;
          attrs: string[];
        },
  ) => {
    return this.apiClient.jolokia.readQueueAttributes({
      ...opts,
      ...this.getTargetOpts(remoteTarget),
    });
  };

  readAddressAttributes = async (
    remoteTarget: string,
    opts:
      | { name: string; attrs?: undefined }
      | { name: string; attrs: string[] },
  ) => {
    return this.apiClient.jolokia.readAddressAttributes({
      ...opts,
      ...this.getTargetOpts(remoteTarget),
    });
  };

  readAcceptorAttributes = async (
    remoteTarget: string,
    opts:
      | { name: string; attrs?: undefined }
      | { name: string; attrs: string[] },
  ) => {
    return this.apiClient.jolokia.readAcceptorAttributes({
      ...opts,
      ...this.getTargetOpts(remoteTarget),
    });
  };

  readClusterConnectionAttributes = async (
    remoteTarget: string,
    opts:
      | { name: string; attrs?: undefined }
      | { name: string; attrs: string[] },
  ) => {
    return this.apiClient.jolokia.readClusterConnectionAttributes({
      ...opts,
      ...this.getTargetOpts(remoteTarget),
    });
  };

  // this method throw error if argValue cannot be converted into
  // correct data
  // note in switch all types are refered in string format instead of
  // the enum values, this is because when running tests
  // the enum values are not treated correctly and you may get error like:
  // TypeError: Cannot read properties of undefined (reading 'Java_lang_Boolean')
  convertValue = (argSchema: ParameterDescriptor, argValue: string): any => {
    switch (argSchema.type as JavaTypes) {
      case 'boolean' as JavaTypes:
      case 'Java.lang.Boolean' as JavaTypes: {
        if (argValue === 'true') {
          return true;
        } else if (argValue === 'false') {
          return false;
        } else {
          throw Error('a boolean value must be true or false');
        }
      }
      case 'double' as JavaTypes: {
        const doubleValue = parseFloat(argValue);
        if (Number.isNaN(doubleValue)) {
          throw Error('invalid double value ' + argValue);
        }
        return doubleValue;
      }
      case 'int' as JavaTypes:
      case 'long' as JavaTypes:
      case 'java.lang.Integer' as JavaTypes:
      case 'java.long.Long' as JavaTypes: {
        const intValue = parseInt(argValue);
        if (Number.isNaN(intValue)) {
          throw Error('invalid int value ' + argValue);
        }
        return intValue;
      }
      case 'Object' as JavaTypes:
      case 'java.lang.Object' as JavaTypes: {
        return JSON.parse(argValue);
      }
      case 'java.lang.String' as JavaTypes: {
        return argValue;
      }
      case 'java.util.Map' as JavaTypes: {
        const jsonObject = JSON.parse(argValue);
        return new Map(Object.entries(jsonObject));
      }
      case '[Ljava.lang.Object;' as JavaTypes:
      case '[Ljava.lang.String;' as JavaTypes:
      case '[Ljava.util.Map;' as JavaTypes: {
        return JSON.parse(argValue);
      }
      default: {
        throw Error('unsupported data type: ' + argSchema.type);
      }
    }
  };

  validateArgs = (schema: OperationSchema, args: string[]): boolean => {
    if (args?.length > 0) {
      if (schema.args?.length === args.length) {
        for (let i = 0; i < schema.args.length; i++) {
          const argSchema = schema.args[i];
          const nameIndex = args[i].indexOf(ServerAccess.ARG_COLON);
          if (nameIndex > 0) {
            //name provided
            const argName = args[i].substring(0, nameIndex);
            if (argSchema.name !== argName) {
              return false;
            }
            const argVal = args[i].substring(
              nameIndex + ServerAccess.ARG_COLON.length,
            );
            try {
              this.convertValue(argSchema, argVal);
              return true;
            } catch (err) {
              return false;
            }
          } else {
            //only value and may have colons as part of value
            try {
              this.convertValue(argSchema, args[i]);
              return true;
            } catch (err) {
              return false;
            }
          }
        }
      } else {
        return false;
      }
    } else {
      if (schema.args?.length === 0) {
        return true;
      }
    }
    return false;
  };

  createOperationArguments = (
    opSchema: OperationSchema,
    args: string[],
  ): OperationArgument[] => {
    if (!args) {
      return null;
    }
    const opArgs = new Array<OperationArgument>();
    for (let i = 0; i < args.length; i++) {
      opArgs.push({
        type: opSchema.args[i].type,
        value: ServerAccess.removeArgName(args[i]),
      });
    }
    return opArgs;
  };

  runAcceptorOperation = async (
    remoteEndpoint: string,
    compName: string,
    opName: string,
    args: string[],
  ) => {
    const values = await this.readAcceptorOperations(
      remoteEndpoint,
      {
        name: compName,
      },
      {
        names: [opName],
      },
    );

    if (values.size === 0) {
      throw Error('no such operation: ' + opName);
    }
    if (values.size !== 1) {
      throw Error('There are multiple schemas for opertion: ' + opName);
    }

    const theSchemas = values.get(opName);
    const match = theSchemas.filter((schema) => {
      return this.validateArgs(schema, args);
    });
    if (match.length === 1) {
      //found it
      const opArgs = this.createOperationArguments(match[0], args);

      return this.apiClient.jolokia.execClusterConnectionOperation(
        {
          signature: {
            name: opName,
            args: opArgs,
          },
        },
        { name: compName, ...this.getTargetOpts(remoteEndpoint) },
      );
    } else if (match.length > 1) {
      throw Error('there are multiple matches for the operation ' + opName);
    } else {
      throw Error('No match found for operation ' + opName);
    }
  };

  runClusterConnectionOperation = async (
    remoteEndpoint: string,
    compName: string,
    opName: string,
    args: string[],
  ) => {
    const values = await this.readClusterConnectionOperations(
      remoteEndpoint,
      {
        name: compName,
      },
      {
        names: [opName],
      },
    );

    if (values.size === 0) {
      throw Error('no such operation: ' + opName);
    }
    if (values.size !== 1) {
      throw Error('There are multiple schemas for opertion: ' + opName);
    }

    const theSchemas = values.get(opName);
    const match = theSchemas.filter((schema) => {
      return this.validateArgs(schema, args);
    });
    if (match.length === 1) {
      //found it
      const opArgs = this.createOperationArguments(match[0], args);

      return this.apiClient.jolokia.execClusterConnectionOperation(
        {
          signature: {
            name: opName,
            args: opArgs,
          },
        },
        { name: compName, ...this.getTargetOpts(remoteEndpoint) },
      );
    } else if (match.length > 1) {
      throw Error('there are multiple matches for the operation ' + opName);
    } else {
      throw Error('No match found for operation ' + opName);
    }
  };

  runBrokerOperation = async (
    remoteEndpoint: string,
    opName: string,
    args: string[],
  ) => {
    const values = await this.readBrokerOperations(remoteEndpoint, {
      names: [opName],
    });
    if (values.size === 0) {
      throw Error('no such operation: ' + opName);
    }
    if (values.size !== 1) {
      throw Error('There are multiple schemas for opertion: ' + opName);
    }

    const theSchemas = values.get(opName);
    const match = theSchemas.filter((schema) => {
      return this.validateArgs(schema, args);
    });

    if (match.length === 1) {
      //found it
      const opArgs = this.createOperationArguments(match[0], args);

      return this.apiClient.jolokia.execBrokerOperation(
        {
          signature: {
            name: opName,
            args: opArgs,
          },
        },
        this.getTargetOpts(remoteEndpoint),
      );
    } else if (match.length > 1) {
      throw Error('there are multiple matches for the operation ' + opName);
    } else {
      throw Error('No match found for operation ' + opName);
    }
  };

  getBrokers = async (remoteEndpoint: string) => {
    return this.apiClient.jolokia.getBrokers(
      this.getTargetOpts(remoteEndpoint),
    );
  };

  listEndpoints = async () => {
    return this.apiClient.admin.listEndpoints();
  };
}
