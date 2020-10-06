FROM node:12-alpine as builder

RUN apk add --update git
WORKDIR /src

COPY . .

RUN yarn install
RUN yarn run build:keeper-bot

CMD "yarn run start start:keeper-bot"
