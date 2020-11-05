FROM node:12-alpine as builder

RUN apk add --update git python make g++
WORKDIR /src

COPY . .

RUN yarn install
RUN yarn run build:keeper-bot

CMD "yarn run start:keeper-bot"
