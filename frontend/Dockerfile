FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY index.html ./
COPY public ./public
COPY src ./src
COPY vite.config.js ./
COPY .eslintrc.cjs ./

ARG VITE_BASE=/bar1/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

RUN npm install -g serve

EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]