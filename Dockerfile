FROM registry.access.redhat.com/ubi8/nodejs-20:latest AS BUILD_IMAGE

### BEGIN REMOTE SOURCE
# Use the COPY instruction only inside the REMOTE SOURCE block
# Use the COPY instruction only to copy files to the container path $REMOTE_SOURCES_DIR/activemq-artemis-jolokia-api-server/app
ARG REMOTE_SOURCES_DIR=/tmp/remote_source
RUN mkdir -p $REMOTE_SOURCES_DIR/activemq-artemis-jolokia-api-server/app
WORKDIR $REMOTE_SOURCES_DIR/activemq-artemis-jolokia-api-server/app
# Copy package.json and yarn.lock to the container
COPY package.json package.json
COPY yarn.lock yarn.lock
ADD . $REMOTE_SOURCES_DIR/activemq-artemis-jolokia-api-server/app
RUN command -v yarn || npm i -g yarn
### END REMOTE SOURCE

USER root

## Set directory
RUN mkdir -p /usr/src/
RUN cp -r $REMOTE_SOURCES_DIR/activemq-artemis-jolokia-api-server/app /usr/src/
WORKDIR /usr/src/app

## Install dependencies
RUN yarn install  --network-timeout 1000000

## Build application
RUN yarn build

FROM registry.access.redhat.com/ubi8/nodejs-20-minimal:latest

USER root

COPY --from=BUILD_IMAGE /usr/src/app/dist /usr/share/amq-spp/dist
COPY --from=BUILD_IMAGE /usr/src/app/.env /usr/share/amq-spp/.env

WORKDIR /usr/share/amq-spp

RUN npm install connect \
cors \
express \
express-openapi-validator \
swagger-routes-express \
typescript \
validator \
yaml \
base-64 \
jsonwebtoken \
dotenv \
express-rate-limit \
node-fetch@2 \
@peculiar/x509

RUN echo "node /usr/share/amq-spp/dist/app.js" > run.sh
RUN chmod +x run.sh

USER 1001

ENV NODE_ENV=production

CMD ["node", "dist/app.js"]

## Labels
LABEL name="artemiscloud/activemq-artemis-jolokia-api-server"
LABEL description="ActiveMQ Artemis Jolokia api-server"
LABEL maintainer="Howard Gao <hgao@redhat.com>"
LABEL version="0.1.1"