FROM node:24 AS development

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM development AS build

RUN npm run build

FROM nginx:stable-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
