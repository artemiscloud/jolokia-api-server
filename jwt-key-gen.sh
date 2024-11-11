#!/usr/bin/env sh

# generate a new jwt secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

