#!/usr/bin/env sh

oc kustomize deploy | oc delete -f -
