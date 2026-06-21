FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY src ./src
COPY public ./public
COPY vite.config.js ./
COPY .eslintrc.cjs ./

RUN npm install && npm run build

RUN npm install -g serve

EXPOSE 80

CMD ["npx", "serve", "-s", "dist", "-l", "80"]