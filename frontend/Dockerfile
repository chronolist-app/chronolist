FROM node:24 AS development

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM development AS build

RUN npm run build

FROM nginx:stable-alpine AS production

RUN apk add --no-cache jq

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/40-api-config.sh /docker-entrypoint.d/40-api-config.sh

RUN chmod +x /docker-entrypoint.d/40-api-config.sh

EXPOSE 80
