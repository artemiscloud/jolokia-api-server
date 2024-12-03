# Jolokia api-server

The Jolokia api-server is an express js server that serves an OpenApi defined
api as an overlay to jolokia servers, translating the jolokia answers to json
when needed.

Checkout the api.md file to know more about what operations are currently
supported.

## Dev setup

```
yarn build
yarn start
```

## Documentation generation

After updating the `openapi.yml` file, please make sure to generate the
documentation:

```
yarn run build-api-doc
```

## Production build

1. Build the image:
   ```sh
   docker build -t quay.io/artemiscloud/activemq-artemis-jolokia-api-server:latest .
   ```
2. Push the image to image registry:
   ```sh
   docker push quay.io/artemiscloud/activemq-artemis-jolokia-api-server:latest
   ```

### deploy the service

```sh
./deploy.sh [-i <image> -ns]
```

The optional `-i <image>` (or `--image <image>`) argument allows you to pass in
the plugin image. If not specified the default
`quay.io/artemiscloud/activemq-artemis-jolokia-api-server:latest` is
deployed. for example:

```sh
./deploy.sh -i quay.io/<repo-username>/activemq-artemis-jolokia-api-server:1.0.1
```

The optional -ns (or --nosec) argument can be used to disable security.

---

**Note:**

you should enable security in your application. Disable security can only
be used for test purposes.

---

The `deploy.sh` script uses `oc kustomize` (built-in
[kustomize](https://github.com/kubernetes-sigs/kustomize)) command to configure
and deploy the plugin using resources and patches defined under ./deploy
directory.

To undeploy, run

```sh
./undeploy.sh
```

### Notes about the JWT secret

The api server uses SECRET_ACCESS_TOKEN env var to get the secret for generating
jwt tokens. It has a default value in .env for dev purposes.

In production you should override it with your own secret.

The jwt-key-gen.sh is a tool to generate a random key and used in Dockerfile.
It makes sure when you build the api server image a new random key is used.

## Security Model of the API Server

The API Server provides a security model that provides authentication and authorization of incoming clients.
The security can be enabled/disabled (i.e. via `API_SERVER_SECURITY_ENABLED` env var)

### Authentication

Currently the api server support `jwt` token authentication.

#### The login api

The login api is defined in openapi.yml

```yaml
/server/login
```

A client logs in to an api server by sending a POST request to the login path. The request body contains login information (i.e. username and password for jwt authentication type)

Please refer to [api.md](api.md) for details of the log api.

Currently the security manager uses local file to store user's info. The default users file name is `.users.json`
The users file name can be configured using `USERS_FILE_URL` env var. See `.test.users.json` for sample values.

### Authorization

Currently the api server doesn't perform authorization on logged in users.

### Endpoints Management

The server keeps a list of jolokia endpoints for clients to access. The endpoints are loaded from a local file named
`.endpoints.json`. Each top level entry represents a jolokia endpoint. An entry has a unique name and details to access the jolokia api. See `.test.endpoints.json` for sample values.

### Accessing a jolokia endpoint

When an authenticated client sends a request to the api-server, it should present its token in the request header

    'Authorization: Bearer `token`'

It also need to give the `targetEndpoint` in the query part of the request if the request is to access an jolokia endpoint.

For example `/execBrokerOperation?targetEndpoint=broker1`.

### Direct Proxy

Direct Proxy means a client can pass a broker's endpoint info to the api-server in order to access it via the api-server.
For example the [self-provisioning plugin](https://github.com/artemiscloud/activemq-artemis-self-provisioning-plugin) uses this api to access the jolokia of a broker deployed by it.

# Jolokia api-server Cli tool (work in progress)

The Jolokia api-server comes with a cli (command line interface) tool. When the cli tool starts it connects to the api-server and can access the jolokia endpoints.

The cli tool takes a **command** and requests the api-server using [its api](src/config/openapi.yml) to invoke on the target jolokia endpint, gets back the response and printing the result to the console in JSON format.

It can run in `interactive mode` or in `non-interactive` mode.

To build the cli tool run

```
yarn build
```

which will build both the api-server and cli tool.

To install the cli tool runnable locally run:

```
npm link
```

It will create the cli runnable `jolokia-api-server-cli`

## Running the cli tool

The cli tool needs a running api-server.

To start the cli tool run

```
jolokia-api-server-cli [options]
```

or you can use `yarn`

```
yarn start-cli [options]
```

## Using Cli tool in non-interactive mode

In this mode, the tool starts and execute a command and then exits.

The syntax for non-interactive mode is:

```
jolokia-api-server-cli <command> -l <api-server-url> -e <jolokia-endpoint-url>
```

If `-l` option is omitted the default is ` https://localhost:9443`

The `-e` option is the target jolokia url. for example

```
-e http://user:password@127.0.0.1:8161
```

If the port number part is omitted, the default
is `80` for http and `443` for https.

The `command` is the command to be executed.

Note in non-interactive mode the `command` need be quoted if

1. the command contains options (e.g -e) because the '-' can be interpreted by the shell
2. the command contains '\*' char

Example:

```
jolokia-api-server-cli "get queue TEST -a MessageCount RoutingType" -e http://user:pass@127.0.0.1:8161
```

Alternatively you can use `--` to separate the command:

```
jolokia-api-server-cli -e http://user:pass@127.0.0.1:8161 -- get @broker2/queue DLQ -a MessageCount
```

## Using Cli tool in interactive mode

In interactive mode the tool starts into a command shell and
accepts user input as a command, then it executes it and went
back to the shell prompt to accept another, until you run the `exit`
command.

The syntax to run the cli in this mode is

```
jolokia-api-server-cli -i
```

When it starts it print the cli title and ready to accept
commands.

With interactive mode the cli can 'caches' a list of jolokia endpoints (added by the `add` command
only available in interactive mode). It takes one of them as `current endpoint` so when user types
a command without specifying target jolokia endpoint, the `current endpoint` will be used.

## Using Cli Commands

### The `get` command

This is the only available command currently. It can retrive
information from a jolokia endpoint.

The syntax of this command is

```
get <path> <name> <-a attributes...> <-o operations...>
```

It takes a `path` argument, a `name` argument, an optional `-a`(attribute) option and an optional
`-o` (operation) option.

The value of `path` is a string representing a target mbean from which you want to get information.
It takes the form [target endpoint]/[component]. The `target endpoint` in `interactive` mode allows
you to specify which broker you want to retrieve information from. If absent it takes the current broker
cached by the cli. In non-interactive mode that [target endpoint] can be empty if `-e` option is given,
or it is the target remote endpoint name prefix by a `@` char. For example `@broker1/`

The `component` part is the type of the mbean. Currently the supported mbean types are

- `queue`
- `address`
- `acceptor`
- `cluster-connection`

---

**NOTE**

If the target component is the broker itself, the component should be left empty. For example

`get @broker1/ -a Status`

It means to get the value of `Status` attribute of the broker.

---

The <name> argument is the mbean name (e.g. DLQ, testQueue, etc).

The value of `-a` option is a list of attribute names (space or comma separated) to read from the target mbean.
If the value is a `*` it will read all the attributes of the target mbean.

The value of `-o` option is a list of operation names (space or comma separated) to read from the target mbean.
If the value is a `*` it will read all the operations of the target mbean.

examples:

`get @broker1/` - get the current broker mbean information

`get @broker1/*` - get all mbeans registered with the broker mbean

`get @broker1/ -a *` - read all the attributes of the broker mbean

`get @broker1/ -a * -o *` - read information of all attributes and operations of the broker mbean

`get @broker1/queue` (or `get /queue`) - list all the queue mbeans information

`get @broker1/acceptor acceptor0 -a *` - read all attributes of acceptor named `acceptor0`

`get @broker1/queue TEST -a MessageCount RoutingType` - read `MessageCount` and `RoutingType` of queue `TEST`

`get @broker1/queue -o xxx` - read information of operation xxx of queue TEST

### The `run` command

The `run` command is used to invoke operations on a jolokia endpoint.

The syntax of this command is

```
run <path> <name> <operation>
```

It takes a `path` argument, a `name` argument and an `operation` to be executed on the mbean.
The syntax for `path` and `name` are the same as for the `get` command.

The operation takes the form <operation-name>([args...]). For example

```
run @broker1/ listAddresses(m)
```

It means to call listAddresses(java.lang.String) method on @broker1 with argument value 'm'.

### Commands exclusive to Interactive mode

There are several commands that are only available to interactive mode.

#### The `add` command

Add a jolokia endpoint to the cli cache. Syntax:

```
add <endpoint name> <url> -u <user> -p <password>
```

example:

```
add ex-aao-ssl https://ex-aao-ssl-wconsj-0-svc-rte-default.apps-crc.testing -u user -p password
```

This command allows user to add a jolokia endpoint that is not managed by the api-server. After the
endpoint is added the user can access the endpoint using the cli commands.

---

**NOTE**

When accessing such jolokia endpoints, the command references it without `@` prefixed, for example

`get ex-aao-ssl/ -a Status`

---

#### The `switch` command

To change `current endpoint`. Syntax:

```
switch <endpoint name>
```

example:

```
switch broker0
```

A command can be simplified if it is targeted at the current endpoint. For example if you
set the current endpoint to `broker0` the command

```
> add broker0 http://127.0.0.2:8161 -u guest -p guest
```

and if you want to get the queues of the broker0, you can do

```
get /queues
```

instead of explicitly:

```
get broker0/queues
```

#### The `list` command

To list all the jolokia endpoints cached in cli and managed on the api-server. Syntax:

```
> list
[
  "local2(local): http://127.0.0.2:8161",
  "@pod-0: https://broker-pem-wconsj-0-svc-ing-default.artemiscloud.io:443",
  "@pod-1: https://broker-pem-wconsj-1-svc-ing-default.artemiscloud.io:443",
  "@local: http://127.0.0.1:8161",
  "@restricted: https://artemis-broker-jolokia-0-svc-ing-default.artemiscloud.io:443"
]

```
