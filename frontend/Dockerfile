FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY index.html ./
COPY public ./public
COPY src ./src
COPY vite.config.js ./
COPY .eslintrc.cjs ./

RUN npm run build

RUN npm install -g serve

EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]