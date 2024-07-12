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
./deploy.sh [-i <image> -n]
```

The optional `-i <image>` (or `--image <image>`) argument allows you to pass in
the plugin image. If not specified the default
`quay.io/artemiscloud/activemq-artemis-jolokia-api-server:latest` is
deployed. for example:

```sh
./deploy.sh -i quay.io/<repo-username>/activemq-artemis-jolokia-api-server:1.0.1
```

The `deploy.sh` script uses `oc kustomize` (built-in
[kustomize](https://github.com/kubernetes-sigs/kustomize)) command to configure
and deploy the plugin using resources and patches defined under ./deploy
directory.

To undeploy, run

```sh
./undeploy.sh
```
